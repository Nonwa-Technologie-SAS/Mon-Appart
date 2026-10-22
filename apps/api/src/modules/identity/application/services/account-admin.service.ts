import { Injectable } from "@nestjs/common"
import type { Role } from "@mon-appart/types"

import { UserStatus } from "../../../../generated/prisma/enums"
import {
  statusForDecision,
  type AccountDecision,
} from "../../domain/account-policy"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import {
  AuditAction,
  IdentityEvent,
  SessionRevocationReason,
} from "../../domain/identity-events"
import {
  IdentityDatabase,
  type Tx,
} from "../../infrastructure/persistence/identity-database"
import { RbacRepository } from "../../infrastructure/repositories/rbac.repository"
import { SessionRepository } from "../../infrastructure/repositories/session.repository"
import {
  UserRepository,
  type UserRecord,
} from "../../infrastructure/repositories/user.repository"
import type { ClientContext } from "../client-context"
import { IdentityActivity } from "./identity-activity.service"
import { SessionService } from "./session.service"

const DECISION_AUDIT: Record<AccountDecision, AuditAction> = {
  SUSPEND: AuditAction.ACCOUNT_SUSPENDED,
  BAN: AuditAction.ACCOUNT_BANNED,
  REACTIVATE: AuditAction.ACCOUNT_REACTIVATED,
}

const DECISION_BY_STATUS: Partial<Record<UserStatus, AccountDecision>> = {
  SUSPENDED: "SUSPEND",
  BANNED: "BAN",
  ACTIVE: "REACTIVATE",
}

const SUPER_ADMIN: Role = "SUPER_ADMIN"

export interface AccountDecisionResult {
  from: UserStatus
  to: UserStatus
  revokedSessions: number
}

/**
 * Invariants d'administration des comptes, quel que soit l'appelant : nul
 * n'agit sur son propre compte, le dernier super administrateur actif ne peut
 * être ni retiré ni bloqué, et tout changement est audité dans sa transaction.
 * Les droits de l'appelant (qui peut faire quoi) sont vérifiés par le
 * back-office avant l'appel.
 */
@Injectable()
export class AccountAdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly rbac: RbacRepository,
    private readonly sessionRows: SessionRepository,
    private readonly sessions: SessionService,
    private readonly db: IdentityDatabase,
    private readonly activity: IdentityActivity,
  ) {}

  /**
   * Attribue ou retire un rôle. Sans effet (et sans audit) si rien ne change.
   * Un retrait révoque les sessions de la cible : ses jetons portent encore
   * l'ancien rôle.
   */
  async changeRole(
    actorPublicId: string,
    targetPublicId: string,
    role: Role,
    operation: "grant" | "revoke",
    context: ClientContext | null,
    reason?: string,
  ): Promise<{ changed: boolean }> {
    const { actor, target } = await this.pair(actorPublicId, targetPublicId)
    const roleId = await this.rbac.roleId(role)
    if (roleId === null) throw new Error(`Rôle inconnu : ${role}`)

    const outcome = await this.db.transaction(async (tx) => {
      const current = await this.lockUser(target, tx)
      const holds = current.roles.includes(role)
      if ((operation === "grant") === holds) return null
      if (operation === "revoke" && role === SUPER_ADMIN) {
        await this.assertNotLastSuperAdmin(target.id, tx)
      }

      if (operation === "grant") {
        await tx.userRole.create({
          data: { userId: target.id, roleId, grantedById: actor.id },
        })
      } else {
        await tx.userRole.deleteMany({ where: { userId: target.id, roleId } })
      }
      await this.activity.audit(
        {
          action: AuditAction.ROLE_CHANGED,
          actorId: actor.id,
          entityType: "user",
          entityId: target.publicId,
          oldValues: { roles: current.roles },
          newValues: {
            operation,
            role,
            ...(reason ? { reason: reason.slice(0, 500) } : {}),
          },
        },
        context,
        tx,
      )
      const families =
        operation === "revoke"
          ? await this.sessionRows.revokeFamilies(
              { userId: target.id },
              SessionRevocationReason.USER_REVOKED,
              tx,
            )
          : []
      return { families }
    })
    if (!outcome) return { changed: false }

    await this.sessions.publishRevocation(
      target,
      outcome.families,
      SessionRevocationReason.USER_REVOKED,
      context,
      { audit: false },
    )
    this.activity.emit(IdentityEvent.RoleChanged, target.publicId, {
      operation,
      role,
    })
    return { changed: true }
  }

  /**
   * Suspension, bannissement ou réactivation : statut, révocation des
   * sessions et audit atomiques. `expectedStatus` protège d'une décision
   * prise sur une fiche périmée.
   */
  async decide(
    actorPublicId: string,
    targetPublicId: string,
    decision: AccountDecision,
    reason: string,
    context: ClientContext | null,
    options: { expectedStatus?: UserStatus } = {},
  ): Promise<AccountDecisionResult> {
    const { actor, target } = await this.pair(actorPublicId, targetPublicId)
    const blocking = decision !== "REACTIVATE"

    const result = await this.db.transaction(async (tx) => {
      const current = await this.lockUser(target, tx)
      if (options.expectedStatus && options.expectedStatus !== current.status) {
        throw authError(AuthErrorCode.ACCOUNT_STATUS_CHANGED)
      }
      const next = statusForDecision(
        decision,
        current.status,
        Boolean(
          (current.email && current.emailVerifiedAt) ||
          (current.phone && current.phoneVerifiedAt),
        ),
      )
      if (!next) throw authError(AuthErrorCode.INVALID_STATUS_CHANGE)
      if (blocking && current.roles.includes(SUPER_ADMIN)) {
        await this.assertNotLastSuperAdmin(target.id, tx)
      }

      await this.users.updateStatus(target.id, next, tx)
      const families = blocking
        ? await this.sessionRows.revokeFamilies(
            { userId: target.id },
            SessionRevocationReason.ACCOUNT_BLOCKED,
            tx,
          )
        : []
      await this.activity.audit(
        {
          action: DECISION_AUDIT[decision],
          actorId: actor.id,
          entityType: "user",
          entityId: target.publicId,
          oldValues: { status: current.status },
          newValues: { status: next, reason: reason.slice(0, 500) },
        },
        context,
        tx,
      )
      return { from: current.status, to: next, families }
    })

    await this.sessions.publishRevocation(
      target,
      result.families,
      SessionRevocationReason.ACCOUNT_BLOCKED,
      context,
      { audit: false },
    )
    this.activity.emit(IdentityEvent.AccountStatusChanged, target.publicId, {
      from: result.from,
      to: result.to,
    })
    return {
      from: result.from,
      to: result.to,
      revokedSessions: result.families.length,
    }
  }

  /** Forme historique de `decide` : SUSPENDED, BANNED ou ACTIVE. */
  async setStatus(
    actorPublicId: string,
    targetPublicId: string,
    status: UserStatus,
    reason: string,
    context: ClientContext | null,
  ): Promise<void> {
    const decision = DECISION_BY_STATUS[status]
    if (!decision) throw authError(AuthErrorCode.INVALID_STATUS_CHANGE)
    await this.decide(actorPublicId, targetPublicId, decision, reason, context)
  }

  /** Déconnecte la cible de tous ses appareils, sans changer son statut. */
  async revokeSessions(
    actorPublicId: string,
    targetPublicId: string,
    reason: string,
    context: ClientContext | null,
  ): Promise<{ revokedSessions: number }> {
    const { actor, target } = await this.pair(actorPublicId, targetPublicId)
    const families = await this.db.transaction(async (tx) => {
      const revoked = await this.sessionRows.revokeFamilies(
        { userId: target.id },
        SessionRevocationReason.USER_REVOKED,
        tx,
      )
      await this.activity.audit(
        {
          action: AuditAction.SESSION_REVOKED,
          actorId: actor.id,
          entityType: "user",
          entityId: target.publicId,
          newValues: {
            reason: reason.slice(0, 500),
            sessions: revoked.length,
            byAdministrator: true,
          },
        },
        context,
        tx,
      )
      return revoked
    })
    await this.sessions.publishRevocation(
      target,
      families,
      SessionRevocationReason.USER_REVOKED,
      context,
      { audit: false },
    )
    return { revokedSessions: families.length }
  }

  private async pair(
    actorPublicId: string,
    targetPublicId: string,
  ): Promise<{ actor: UserRecord; target: UserRecord }> {
    if (actorPublicId === targetPublicId) {
      throw authError(AuthErrorCode.SELF_ADMINISTRATION_FORBIDDEN)
    }
    const [actor, target] = await Promise.all([
      this.users.findByPublicId(actorPublicId),
      this.users.findByPublicId(targetPublicId),
    ])
    if (!actor) throw authError(AuthErrorCode.UNAUTHENTICATED)
    if (!target) throw authError(AuthErrorCode.USER_NOT_FOUND)
    return { actor, target }
  }

  /**
   * Verrou de ligne : deux décisions sur un même compte s'exécutent l'une
   * après l'autre. `NO KEY UPDATE` laisse passer les contrôles de clé
   * étrangère (audit, sessions) des autres transactions. Pour un SUPER_ADMIN,
   * le verrou de garde est pris avant la ligne, dans un ordre fixe.
   */
  private async lockUser(
    user: { id: bigint; roles: readonly Role[] },
    tx: Tx,
  ): Promise<UserRecord> {
    if (user.roles.includes(SUPER_ADMIN)) await this.lockSuperAdminGuard(tx)
    const userId = user.id
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`
    const current = await this.users.findById(userId, tx)
    if (!current) throw authError(AuthErrorCode.USER_NOT_FOUND)
    return current
  }

  /**
   * Verrou consultatif de transaction (réentrant) : deux retraits concurrents
   * de SUPER_ADMIN sont sérialisés et le second relit le décompte après
   * validation du premier.
   */
  private async lockSuperAdminGuard(tx: Tx): Promise<void> {
    await tx.$queryRaw`
      SELECT 1 AS locked
      FROM pg_advisory_xact_lock(hashtext('identity:super_admin_guard'))
    `
  }

  /** Refuse de retirer ou de bloquer le dernier SUPER_ADMIN actif. */
  private async assertNotLastSuperAdmin(
    targetId: bigint,
    tx: Tx,
  ): Promise<void> {
    await this.lockSuperAdminGuard(tx)
    const holders = await tx.$queryRaw<Array<{ user_id: bigint }>>`
      SELECT ur.user_id
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN users u ON u.id = ur.user_id
      WHERE r.code = ${SUPER_ADMIN}
        AND u.deleted_at IS NULL
        AND u.status = 'ACTIVE'
    `
    const others = holders.filter((row) => row.user_id !== targetId)
    if (others.length === 0) throw authError(AuthErrorCode.LAST_SUPER_ADMIN)
  }
}
