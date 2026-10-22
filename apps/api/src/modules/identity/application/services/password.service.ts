import { Inject, Injectable, Logger } from "@nestjs/common"

import { safeErrorMessage } from "../../../../common/http/safe-error"
import { PasswordHasher } from "../../../../common/security/password-hasher"
import { UserStatus } from "../../../../generated/prisma/enums"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import { parseIdentifier } from "../../domain/identifier"
import {
  AuditAction,
  IdentityEvent,
  SessionRevocationReason,
} from "../../domain/identity-events"
import { assertPasswordStrength } from "../../domain/password-policy"
import { IdentityConfig } from "../../identity.config"
import {
  generateOpaqueToken,
  SecretHasher,
} from "../../infrastructure/crypto/secret-hasher"
import { IdentityDatabase } from "../../infrastructure/persistence/identity-database"
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  type EmailProvider,
  type SmsProvider,
} from "../../infrastructure/providers/notification.providers"
import { PasswordResetRepository } from "../../infrastructure/repositories/password-reset.repository"
import { SessionRepository } from "../../infrastructure/repositories/session.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import type { ClientContext } from "../client-context"
import { AuthThrottle } from "./auth-throttle.service"
import { IdentityActivity } from "./identity-activity.service"
import { SessionService } from "./session.service"

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name)

  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly sessionRows: SessionRepository,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordHasher,
    private readonly hasher: SecretHasher,
    private readonly throttle: AuthThrottle,
    private readonly config: IdentityConfig,
    private readonly db: IdentityDatabase,
    private readonly activity: IdentityActivity,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /** Révoque les autres sessions ; la session courante reste valide. */
  async change(
    auth: AuthenticatedUser,
    input: { currentPassword: string; newPassword: string },
    context: ClientContext,
  ): Promise<{ revokedSessions: number }> {
    const user = await this.users.findByPublicId(auth.id)
    if (!user) throw authError(AuthErrorCode.SESSION_REVOKED)
    await this.sessions.assertActive(user, auth.sessionId)

    const subject = `user:${user.publicId}`
    await this.throttle.assertNotLocked(
      "password-change-failures",
      subject,
      this.config.maxLoginAttempts,
    )
    const valid = user.passwordHash
      ? await this.passwords.verify(user.passwordHash, input.currentPassword)
      : await this.passwords.verifyAgainstDummy(input.currentPassword)
    if (!valid) {
      await this.throttle.recordFailure(
        "password-change-failures",
        subject,
        this.config.maxLoginAttempts,
        this.config.loginFailureWindowSeconds,
      )
      throw authError(AuthErrorCode.INVALID_CURRENT_PASSWORD)
    }
    assertPasswordStrength(input.newPassword, user)
    await this.throttle.clear("password-change-failures", subject)

    const passwordHash = await this.passwords.hash(input.newPassword)
    const families = await this.db.transaction(async (tx) => {
      await this.users.updatePassword(user.id, passwordHash, tx)
      await this.resets.invalidateAll(user.id, tx)
      const revoked = await this.sessionRows.revokeFamilies(
        { userId: user.id, exceptFamilyId: auth.sessionId },
        SessionRevocationReason.PASSWORD_CHANGED,
        tx,
      )
      await this.activity.audit(
        {
          action: AuditAction.PASSWORD_CHANGED,
          actorId: user.id,
          entityType: "user",
          entityId: user.publicId,
          newValues: { revokedSessions: revoked.length },
        },
        context,
        tx,
      )
      return revoked
    })
    await this.sessions.publishRevocation(
      user,
      families,
      SessionRevocationReason.PASSWORD_CHANGED,
      context,
      { audit: false },
    )
    this.activity.emit(IdentityEvent.PasswordChanged, user.publicId, {
      revokedSessions: families.length,
    })
    this.activity.log("password_changed", context, {
      user_id: user.publicId,
      session_id: auth.sessionId,
    })
    return { revokedSessions: families.length }
  }

  /**
   * Réponse identique que le compte existe ou non. Seule la limite par IP est
   * signalée (429) ; la limite par identifiant est silencieuse.
   */
  async requestReset(
    identifierInput: string,
    context: ClientContext,
  ): Promise<void> {
    await this.throttle.enforce(
      "reset-request",
      this.throttle.ip(context),
      this.config.resetRateLimit,
    )
    const identifier = parseIdentifier(identifierInput)
    if (!identifier) return
    const subject = `${identifier.kind}:${identifier.value}`
    if (
      !(await this.throttle.allow(
        "reset-request-identifier",
        subject,
        this.config.resetRateLimit,
      ))
    ) {
      return
    }

    const user = await this.users.findByIdentifier(identifier)
    if (!user || user.status === UserStatus.BANNED) return

    const token = generateOpaqueToken()
    const expiresAt = new Date(Date.now() + this.config.passwordResetTtlMs)
    await this.db.transaction((tx) =>
      this.resets.replace(
        user.id,
        this.hasher.hash("password-reset", token),
        expiresAt,
        tx,
      ),
    )

    const message = {
      to: identifier.value,
      resetUrl: `${this.config.webAppUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresInMinutes: Math.round(this.config.passwordResetTtlMs / 60_000),
    }
    const delivery =
      identifier.kind === "email"
        ? this.email.sendPasswordReset(message)
        : this.sms.sendPasswordReset(message)
    delivery.catch((error: unknown) =>
      this.logger.warn(
        `Lien de réinitialisation non envoyé : ${safeErrorMessage(error)}`,
      ),
    )

    this.activity.metrics.auth.passwordResetRequested.inc()
    this.activity.emit(IdentityEvent.PasswordResetRequested, user.publicId, {
      channel: identifier.kind,
    })
    this.activity.log("password_reset_requested", context, {
      user_id: user.publicId,
    })
  }

  /** Consommation du jeton, nouveau mot de passe et révocation des sessions : une transaction. */
  async reset(
    token: string,
    newPassword: string,
    context: ClientContext,
  ): Promise<void> {
    await this.throttle.enforce(
      "reset-confirm",
      this.throttle.ip(context),
      this.config.resetRateLimit * 2,
    )
    const row = await this.resets.findByHash(
      this.hasher.hash("password-reset", token),
    )
    if (!row || row.usedAt) throw authError(AuthErrorCode.RESET_TOKEN_INVALID)
    if (row.expiresAt.getTime() <= Date.now())
      throw authError(AuthErrorCode.RESET_TOKEN_EXPIRED)

    const user = await this.users.findById(row.userId)
    if (!user || user.status === UserStatus.BANNED)
      throw authError(AuthErrorCode.RESET_TOKEN_INVALID)
    assertPasswordStrength(newPassword, user)
    const passwordHash = await this.passwords.hash(newPassword)

    const families = await this.db.transaction(async (tx) => {
      if (!(await this.resets.consume(row.id, tx)))
        throw authError(AuthErrorCode.RESET_TOKEN_INVALID)
      await this.resets.invalidateAll(user.id, tx)
      await this.users.updatePassword(user.id, passwordHash, tx)
      const revoked = await this.sessionRows.revokeFamilies(
        { userId: user.id },
        SessionRevocationReason.PASSWORD_RESET,
        tx,
      )
      await this.activity.audit(
        {
          action: AuditAction.PASSWORD_RESET,
          actorId: user.id,
          entityType: "user",
          entityId: user.publicId,
          newValues: { revokedSessions: revoked.length },
        },
        context,
        tx,
      )
      return revoked
    })

    await this.sessions.publishRevocation(
      user,
      families,
      SessionRevocationReason.PASSWORD_RESET,
      context,
      { audit: false },
    )
    for (const contact of [
      user.email && `email:${user.email}`,
      user.phone && `phone:${user.phone}`,
    ]) {
      if (contact) await this.throttle.clear("login-failures", contact)
    }
    this.activity.emit(IdentityEvent.PasswordResetCompleted, user.publicId, {
      revokedSessions: families.length,
    })
    this.activity.log("password_reset_completed", context, {
      user_id: user.publicId,
    })
  }
}
