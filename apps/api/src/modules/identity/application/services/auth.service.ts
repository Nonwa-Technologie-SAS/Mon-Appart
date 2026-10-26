import { Inject, Injectable, Logger } from "@nestjs/common"

import { PasswordHasher } from "../../../../common/security/password-hasher"
import { safeErrorMessage } from "../../../../common/http/safe-error"
import { VerificationType } from "../../../../generated/prisma/enums"
import { loginBlockReason } from "../../domain/account-policy"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import {
  parseIdentifier,
  requireEmail,
  requirePhone,
} from "../../domain/identifier"
import {
  AuditAction,
  IdentityEvent,
  SessionRevocationReason,
} from "../../domain/identity-events"
import { assertPasswordStrength } from "../../domain/password-policy"
import {
  isPublicRegisterRole,
  resolveRegisterRole,
  roleNeedsOrganization,
} from "../../domain/register-account-type"
import { IdentityConfig } from "../../identity.config"
import {
  IdentityDatabase,
  isUniqueViolation,
} from "../../infrastructure/persistence/identity-database"
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from "../../infrastructure/providers/notification.providers"
import { RbacRepository } from "../../infrastructure/repositories/rbac.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import type { ClientContext, DeviceInfo } from "../client-context"
import { AuthThrottle } from "./auth-throttle.service"
import { IdentityActivity } from "./identity-activity.service"
import { SessionService, type IssuedSession } from "./session.service"

export interface RegisterInput extends DeviceInfo {
  email?: string
  phone?: string
  password: string
  firstName?: string
  lastName?: string
  /** CUSTOMER | OWNER | AGENCY — défaut CUSTOMER. */
  accountType?: string
  organizationName?: string
  organizationAddress?: string
}

export interface LoginInput extends DeviceInfo {
  identifier: string
  password: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly users: UserRepository,
    private readonly rbac: RbacRepository,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordHasher,
    private readonly throttle: AuthThrottle,
    private readonly config: IdentityConfig,
    private readonly db: IdentityDatabase,
    private readonly activity: IdentityActivity,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /** Utilisateur PENDING + rôle public + vérifications en attente, en une transaction. */
  async register(
    input: RegisterInput,
    context: ClientContext,
  ): Promise<IssuedSession> {
    await this.throttle.enforce(
      "register",
      this.throttle.ip(context),
      this.config.registerRateLimit,
    )

    const email = input.email ? requireEmail(input.email) : null
    const phone = input.phone ? requirePhone(input.phone) : null
    if (!email && !phone) throw authError(AuthErrorCode.CONTACT_REQUIRED)
    assertPasswordStrength(input.password, { email, phone })

    const rawType = input.accountType?.trim()
    if (rawType && !isPublicRegisterRole(rawType)) {
      throw authError(AuthErrorCode.INVALID_ACCOUNT_TYPE)
    }
    const role = resolveRegisterRole(rawType)
    const organizationName = input.organizationName?.trim() || null
    const organizationAddress = input.organizationAddress?.trim() || null
    if (roleNeedsOrganization(role) && !organizationName) {
      throw authError(AuthErrorCode.ORGANIZATION_REQUIRED)
    }

    if (email && (await this.users.contactTaken("email", email))) {
      throw authError(AuthErrorCode.EMAIL_ALREADY_USED)
    }
    if (phone && (await this.users.contactTaken("phone", phone))) {
      throw authError(AuthErrorCode.PHONE_ALREADY_USED)
    }

    const passwordHash = await this.passwords.hash(input.password)
    const channels = [
      ...(phone ? [VerificationType.PHONE] : []),
      ...(email ? [VerificationType.EMAIL] : []),
    ]

    let created: { id: bigint; publicId: string }
    try {
      created = await this.db.transaction(async (tx) => {
        const roleId = await this.rbac.roleId(role, tx)
        if (roleId === null)
          throw new Error(`Rôle ${role} absent : lancer le seed de référence`)
        const user = await this.users.create(
          {
            email,
            phone,
            passwordHash,
            firstName: input.firstName?.trim() || null,
            lastName: input.lastName?.trim() || null,
          },
          tx,
        )
        await this.users.assignRole(user.id, roleId, null, tx)
        await this.users.createPendingVerifications(user.id, channels, tx)
        await this.activity.audit(
          {
            action: AuditAction.USER_REGISTERED,
            actorId: user.id,
            entityType: "user",
            entityId: user.publicId,
            newValues: {
              channels,
              role,
              ...(organizationName ? { organizationName } : {}),
              ...(organizationAddress ? { organizationAddress } : {}),
            },
          },
          context,
          tx,
        )
        await this.activity.enqueue(tx, {
          name: IdentityEvent.UserRegistered,
          producer: "identity",
          aggregateType: "user",
          aggregateId: user.publicId,
          payload: { channels, role },
          correlationId: context.requestId,
        })
        return user
      })
    } catch (error) {
      // Deux inscriptions simultanées : l'index unique partiel tranche.
      if (isUniqueViolation(error))
        throw authError(AuthErrorCode.ACCOUNT_ALREADY_EXISTS)
      throw error
    }

    const user = await this.users.findById(created.id)
    if (!user) throw new Error("Utilisateur introuvable après inscription")
    const issued = await this.sessions.open(user, input, context)

    await this.activity.flush()
    this.activity.log("user_registered", context, {
      user_id: user.publicId,
      session_id: issued.sessionId,
      role,
    })
    if (email) {
      this.email
        .sendWelcomeEmail({ to: email, firstName: user.firstName })
        .catch((error: unknown) =>
          this.logger.warn(
            `Email de bienvenue non envoyé : ${safeErrorMessage(error)}`,
          ),
        )
    }
    return issued
  }

  async login(
    input: LoginInput,
    context: ClientContext,
  ): Promise<IssuedSession> {
    await this.throttle.enforce(
      "login",
      this.throttle.ip(context),
      this.config.loginRateLimit,
    )

    const identifier = parseIdentifier(input.identifier)
    const subject = identifier
      ? `${identifier.kind}:${identifier.value}`
      : `raw:${input.identifier.trim().toLowerCase()}`
    await this.throttle.assertNotLocked(
      "login-failures",
      subject,
      this.config.maxLoginAttempts,
    )

    const user = identifier
      ? await this.users.findByIdentifier(identifier)
      : null
    const valid = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.passwords.verifyAgainstDummy(input.password)

    if (!user || !valid) {
      await this.throttle.recordFailure(
        "login-failures",
        subject,
        this.config.maxLoginAttempts,
        this.config.loginFailureWindowSeconds,
      )
      await this.activity.audit(
        {
          action: AuditAction.LOGIN_FAILED,
          actorId: null,
          entityType: "user",
          entityId: user?.publicId ?? "unknown",
          newValues: {
            reason: "invalid_credentials",
            identifierType: identifier?.kind ?? "invalid",
          },
        },
        context,
      )
      this.activity.metrics.auth.loginFailure.inc({
        reason: "invalid_credentials",
      })
      this.activity.log("login_failed", context, {
        reason: "invalid_credentials",
        user_id: user?.publicId,
      })
      throw authError(AuthErrorCode.INVALID_CREDENTIALS)
    }

    // Le statut n'est révélé qu'après un mot de passe correct.
    const blocked = loginBlockReason(user.status)
    if (blocked) {
      await this.activity.audit(
        {
          action: AuditAction.LOGIN_FAILED,
          actorId: user.id,
          entityType: "user",
          entityId: user.publicId,
          newValues: { reason: blocked },
        },
        context,
      )
      this.activity.metrics.auth.loginFailure.inc({ reason: blocked })
      this.activity.log("login_failed", context, {
        reason: blocked,
        user_id: user.publicId,
      })
      throw authError(blocked)
    }

    await this.throttle.clear("login-failures", subject)
    const issued = await this.sessions.open(user, input, context)
    await this.users.touchLastLogin(user.id)
    await this.activity.audit(
      {
        action: AuditAction.LOGIN_SUCCESS,
        actorId: user.id,
        entityType: "user",
        entityId: user.publicId,
        newValues: { sessionId: issued.sessionId, method: "PASSWORD" },
      },
      context,
    )
    this.activity.metrics.auth.loginSuccess.inc()
    this.activity.emit(IdentityEvent.UserLoggedIn, user.publicId, {
      sessionId: issued.sessionId,
      method: "PASSWORD",
    })
    this.activity.log("login_success", context, {
      user_id: user.publicId,
      session_id: issued.sessionId,
    })
    return issued
  }

  refresh(
    refreshToken: string,
    context: ClientContext,
  ): Promise<IssuedSession> {
    return this.sessions.refresh(refreshToken, context)
  }

  async logout(auth: AuthenticatedUser, context: ClientContext): Promise<void> {
    const user = await this.users.findByPublicId(auth.id)
    if (!user) return
    await this.sessions.revokeAndPublish(
      user,
      { familyId: auth.sessionId },
      SessionRevocationReason.LOGOUT,
      context,
    )
    this.activity.emit(IdentityEvent.UserLoggedOut, user.publicId, {
      sessionId: auth.sessionId,
    })
    this.activity.log("logout", context, {
      user_id: user.publicId,
      session_id: auth.sessionId,
    })
  }

  async logoutAll(
    auth: AuthenticatedUser,
    context: ClientContext,
  ): Promise<number> {
    const user = await this.users.findByPublicId(auth.id)
    if (!user) throw authError(AuthErrorCode.SESSION_REVOKED)
    await this.sessions.assertActive(user, auth.sessionId)
    const families = await this.sessions.revokeAndPublish(
      user,
      {},
      SessionRevocationReason.LOGOUT_ALL,
      context,
    )
    this.activity.emit(IdentityEvent.UserLoggedOut, user.publicId, {
      sessionId: auth.sessionId,
      allSessions: true,
    })
    this.activity.log("logout_all", context, {
      user_id: user.publicId,
      session_id: auth.sessionId,
      revoked: families.length,
    })
    return families.length
  }
}
