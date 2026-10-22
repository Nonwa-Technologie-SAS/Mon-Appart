import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { loginBlockReason } from "../../domain/account-policy"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import {
  AuditAction,
  IdentityEvent,
  SessionRevocationReason,
} from "../../domain/identity-events"
import { IdentityConfig } from "../../identity.config"
import {
  generateOpaqueToken,
  SecretHasher,
} from "../../infrastructure/crypto/secret-hasher"
import {
  IdentityDatabase,
  toInet,
  truncate,
  type Db,
} from "../../infrastructure/persistence/identity-database"
import {
  SessionRepository,
  type SessionRecord,
} from "../../infrastructure/repositories/session.repository"
import {
  UserRepository,
  type UserRecord,
} from "../../infrastructure/repositories/user.repository"
import { AccessTokenService } from "../../infrastructure/tokens/access-token.service"
import { SessionRevocationStore } from "../../infrastructure/tokens/session-revocation.store"
import type { ClientContext, DeviceInfo } from "../client-context"
import { IdentityActivity } from "./identity-activity.service"

export interface IssuedSession {
  user: UserRecord
  sessionId: string
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
  refreshTokenExpiresAt: Date
}

type SessionOwner = Pick<UserRecord, "id" | "publicId">

/**
 * Sessions à refresh token rotatif. Chaque refresh révoque la ligne courante
 * (ROTATED) et en crée une nouvelle dans la même famille. Présenter un token
 * déjà tourné révèle un vol : toute la famille est révoquée.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly tokens: AccessTokenService,
    private readonly hasher: SecretHasher,
    private readonly revocations: SessionRevocationStore,
    private readonly config: IdentityConfig,
    private readonly db: IdentityDatabase,
    private readonly activity: IdentityActivity,
  ) {}

  async open(
    user: UserRecord,
    device: DeviceInfo,
    context: ClientContext,
  ): Promise<IssuedSession> {
    const refreshToken = generateOpaqueToken()
    const familyId = randomUUID()
    const session = await this.sessions.create({
      userId: user.id,
      familyId,
      tokenHash: this.hasher.hash("refresh-token", refreshToken),
      deviceId: truncate(device.deviceId, 128),
      deviceName: truncate(device.deviceName, 150),
      ipAddress: toInet(context.ip),
      userAgent: truncate(context.userAgent, 512),
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlMs),
    })
    const access = await this.tokens.sign({
      userId: user.publicId,
      sessionId: familyId,
      roles: user.roles,
    })
    this.activity.emit(IdentityEvent.SessionCreated, user.publicId, {
      sessionId: familyId,
    })
    return {
      user,
      sessionId: familyId,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    }
  }

  /** Le refresh token est toujours validé contre PostgreSQL. */
  async refresh(
    refreshToken: string,
    context: ClientContext,
  ): Promise<IssuedSession> {
    const current = await this.sessions.findByTokenHash(
      this.hasher.hash("refresh-token", refreshToken),
    )
    if (!current) {
      this.activity.metrics.auth.refresh.inc({ outcome: "unknown" })
      throw authError(AuthErrorCode.SESSION_REVOKED)
    }
    if (current.revokedAt) {
      if (current.revokedReason === SessionRevocationReason.ROTATED) {
        await this.handleReuse(current, context)
      }
      this.activity.metrics.auth.refresh.inc({ outcome: "revoked" })
      throw authError(AuthErrorCode.SESSION_REVOKED)
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      this.activity.metrics.auth.refresh.inc({ outcome: "expired" })
      throw authError(AuthErrorCode.TOKEN_EXPIRED)
    }

    const user = await this.users.findById(current.userId)
    if (!user) {
      // Compte supprimé (soft delete) : la session ne doit plus servir.
      await this.sessions.revokeFamilies(
        { userId: current.userId, familyId: current.familyId },
        SessionRevocationReason.ACCOUNT_BLOCKED,
      )
      await this.revocations.revoke([current.familyId])
      throw authError(AuthErrorCode.SESSION_REVOKED)
    }
    const blocked = loginBlockReason(user.status)
    if (blocked) {
      await this.revokeAndPublish(
        user,
        { familyId: current.familyId },
        SessionRevocationReason.ACCOUNT_BLOCKED,
        context,
      )
      throw authError(blocked)
    }

    const nextToken = generateOpaqueToken()
    const rotated = await this.db.transaction(async (tx) => {
      if (!(await this.sessions.markRotated(current.id, tx))) return null
      return this.sessions.create(
        {
          userId: user.id,
          familyId: current.familyId,
          tokenHash: this.hasher.hash("refresh-token", nextToken),
          deviceId: current.deviceId,
          deviceName: current.deviceName,
          ipAddress: toInet(context.ip) ?? current.ipAddress,
          userAgent: truncate(context.userAgent, 512) ?? current.userAgent,
          expiresAt: new Date(Date.now() + this.config.refreshTokenTtlMs),
        },
        tx,
      )
    })
    if (!rotated) {
      // Une requête concurrente a déjà fait tourner ce token.
      await this.handleReuse(current, context)
      throw authError(AuthErrorCode.SESSION_REVOKED)
    }

    const access = await this.tokens.sign({
      userId: user.publicId,
      sessionId: current.familyId,
      roles: user.roles,
    })
    this.activity.metrics.auth.refresh.inc({ outcome: "rotated" })
    this.activity.emit(IdentityEvent.RefreshTokenRotated, user.publicId, {
      sessionId: current.familyId,
    })
    return {
      user,
      sessionId: current.familyId,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextToken,
      refreshTokenExpiresAt: rotated.expiresAt,
    }
  }

  /** Vérification en base pour les opérations sensibles. */
  async assertActive(
    user: SessionOwner,
    sessionId: string,
  ): Promise<SessionRecord> {
    const session = await this.sessions.findActiveInFamily(user.id, sessionId)
    if (!session) throw authError(AuthErrorCode.SESSION_REVOKED)
    return session
  }

  listActive(user: SessionOwner): Promise<SessionRecord[]> {
    return this.sessions.listActive(user.id)
  }

  async revokeAndPublish(
    user: SessionOwner,
    scope: { familyId?: string; exceptFamilyId?: string },
    reason: SessionRevocationReason,
    context: ClientContext | null,
    db?: Db,
  ): Promise<string[]> {
    const families = await this.sessions.revokeFamilies(
      { userId: user.id, ...scope },
      reason,
      db,
    )
    if (!db)
      await this.publishRevocation(user, families, reason, context, {
        audit: true,
      })
    return families
  }

  /** À appeler après validation de la transaction qui a révoqué les sessions. */
  async publishRevocation(
    user: SessionOwner,
    families: readonly string[],
    reason: SessionRevocationReason,
    context: ClientContext | null,
    options: { audit: boolean },
  ): Promise<void> {
    if (families.length === 0) return
    await this.revocations.revoke(families)
    if (options.audit) {
      await this.activity.audit(
        {
          action: AuditAction.SESSION_REVOKED,
          actorId: user.id,
          entityType: "user",
          entityId: user.publicId,
          newValues: { reason, sessions: families.length },
        },
        context,
      )
    }
    for (const sessionId of families) {
      this.activity.emit(IdentityEvent.SessionRevoked, user.publicId, {
        sessionId,
        reason,
      })
    }
  }

  private async handleReuse(
    session: SessionRecord,
    context: ClientContext,
  ): Promise<void> {
    const families = await this.sessions.revokeFamilies(
      { userId: session.userId, familyId: session.familyId },
      SessionRevocationReason.REUSE_DETECTED,
    )
    await this.revocations.revoke([session.familyId])
    const user = await this.users.findById(session.userId)
    const publicId = user?.publicId ?? session.familyId
    await this.activity.audit(
      {
        action: AuditAction.REFRESH_TOKEN_REUSE_DETECTED,
        actorId: session.userId,
        entityType: "auth_session",
        entityId: session.familyId,
        newValues: { revokedSessions: families.length },
      },
      context,
    )
    this.activity.metrics.auth.refreshReuse.inc()
    this.activity.warn("refresh_token_reuse_detected", context, {
      user_id: publicId,
      session_id: session.familyId,
    })
    this.activity.emit(IdentityEvent.RefreshTokenReuseDetected, publicId, {
      sessionId: session.familyId,
    })
  }
}
