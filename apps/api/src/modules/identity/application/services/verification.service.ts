import { Inject, Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { safeErrorMessage } from "../../../../common/http/safe-error"
import {
  OtpChannel,
  OtpPurpose,
  type UserStatus,
} from "../../../../generated/prisma/enums"
import { statusAfterVerification } from "../../domain/account-policy"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import { AuditAction, IdentityEvent } from "../../domain/identity-events"
import {
  evaluateOtp,
  generateOtpCode,
  otpPrecheck,
} from "../../domain/otp-policy"
import { IdentityConfig } from "../../identity.config"
import { SecretHasher } from "../../infrastructure/crypto/secret-hasher"
import { IdentityDatabase } from "../../infrastructure/persistence/identity-database"
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  type EmailProvider,
  type SmsProvider,
} from "../../infrastructure/providers/notification.providers"
import { OtpChallengeRepository } from "../../infrastructure/repositories/otp-challenge.repository"
import {
  UserRepository,
  type UserRecord,
} from "../../infrastructure/repositories/user.repository"
import type { ClientContext } from "../client-context"
import { AuthThrottle } from "./auth-throttle.service"
import { IdentityActivity } from "./identity-activity.service"

export type ContactChannel = "PHONE" | "EMAIL"

export interface OtpChallengeIssued {
  challengeId: string
  expiresAt: Date
  resendAvailableAt: Date
}

const CHANNELS = {
  PHONE: {
    purpose: OtpPurpose.PHONE_VERIFICATION,
    otpChannel: OtpChannel.SMS,
    missing: AuthErrorCode.PHONE_MISSING,
    alreadyVerified: AuthErrorCode.PHONE_ALREADY_VERIFIED,
    audit: AuditAction.PHONE_VERIFIED,
    event: IdentityEvent.PhoneVerified,
  },
  EMAIL: {
    purpose: OtpPurpose.EMAIL_VERIFICATION,
    otpChannel: OtpChannel.EMAIL,
    missing: AuthErrorCode.EMAIL_MISSING,
    alreadyVerified: AuthErrorCode.EMAIL_ALREADY_VERIFIED,
    audit: AuditAction.EMAIL_VERIFIED,
    event: IdentityEvent.EmailVerified,
  },
} as const

/**
 * Vérification d'email et de téléphone par OTP. Redis porte les limites et le
 * délai de renvoi ; PostgreSQL reste la référence pour la validité du code
 * (expiration, essais, consommation unique).
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name)

  constructor(
    private readonly users: UserRepository,
    private readonly otps: OtpChallengeRepository,
    private readonly hasher: SecretHasher,
    private readonly throttle: AuthThrottle,
    private readonly config: IdentityConfig,
    private readonly db: IdentityDatabase,
    private readonly activity: IdentityActivity,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async request(
    auth: AuthenticatedUser,
    channel: ContactChannel,
    context: ClientContext,
  ): Promise<OtpChallengeIssued> {
    const settings = CHANNELS[channel]
    const user = await this.requireUser(auth)
    const destination = this.destination(user, channel)
    if (!destination) throw authError(settings.missing)
    if (this.isVerified(user, channel))
      throw authError(settings.alreadyVerified)

    await this.throttle.enforce(
      "otp-request",
      `user:${user.publicId}`,
      this.config.otpRateLimit,
    )
    await this.throttle.enforce(
      "otp-request",
      this.throttle.ip(context),
      this.config.otpRateLimit * 4,
    )

    const now = Date.now()
    const cooldownMs = this.config.otpResendCooldownSeconds * 1000
    const last = await this.otps.findLatest(user.id, settings.purpose)
    if (last && last.createdAt.getTime() + cooldownMs > now) {
      const retryAfter = Math.ceil(
        (last.createdAt.getTime() + cooldownMs - now) / 1000,
      )
      throw authError(AuthErrorCode.OTP_COOLDOWN, retryAfter)
    }
    // Verrou Redis : deux demandes simultanées ne créent pas deux codes.
    const lock = await this.throttle.acquireCooldown(
      `otp:${settings.purpose}:${user.publicId}`,
      this.config.otpResendCooldownSeconds,
    )
    if (!lock.acquired)
      throw authError(AuthErrorCode.OTP_COOLDOWN, lock.retryAfterSeconds)

    const code = generateOtpCode(this.config.otpLength)
    const publicId = randomUUID()
    const expiresAt = new Date(now + this.config.otpTtlMs)
    await this.db.transaction(async (tx) => {
      await this.otps.supersedeActive(user.id, settings.purpose, tx)
      await this.otps.create(
        {
          publicId,
          userId: user.id,
          channel: settings.otpChannel,
          purpose: settings.purpose,
          destinationHash: this.hasher.hash("otp-destination", destination),
          codeHash: this.hasher.hash("otp-code", `${publicId}:${code}`),
          maxAttempts: this.config.otpMaxAttempts,
          expiresAt,
        },
        tx,
      )
    })

    const provider = channel === "PHONE" ? this.sms : this.email
    try {
      await provider.sendVerificationCode({
        to: destination,
        code,
        purpose: settings.purpose,
        expiresInMinutes: Math.max(
          1,
          Math.round(this.config.otpTtlMs / 60_000),
        ),
      })
      this.activity.metrics.auth.otpSent.inc({ channel: settings.otpChannel })
    } catch (error) {
      this.logger.warn(
        `Code de vérification non envoyé : ${safeErrorMessage(error)}`,
      )
    }
    this.activity.log("otp_requested", context, {
      user_id: user.publicId,
      session_id: auth.sessionId,
      purpose: settings.purpose,
    })
    return {
      challengeId: publicId,
      expiresAt,
      resendAvailableAt: new Date(now + cooldownMs),
    }
  }

  async confirm(
    auth: AuthenticatedUser,
    channel: ContactChannel,
    input: { code: string; challengeId?: string },
    context: ClientContext,
  ): Promise<{ status: UserStatus }> {
    const settings = CHANNELS[channel]
    const user = await this.requireUser(auth)
    const destination = this.destination(user, channel)
    if (!destination) throw authError(settings.missing)
    if (this.isVerified(user, channel))
      throw authError(settings.alreadyVerified)

    const challenge = await this.otps.findForUser(
      user.id,
      settings.purpose,
      input.challengeId,
    )
    if (!challenge) return this.reject("not_found", AuthErrorCode.OTP_INVALID)

    const now = new Date()
    const precheck = otpPrecheck(challenge, now)
    if (precheck === "CONSUMED")
      return this.reject("consumed", AuthErrorCode.OTP_INVALID)
    if (precheck === "EXPIRED")
      return this.reject("expired", AuthErrorCode.OTP_EXPIRED)
    if (precheck === "MAX_ATTEMPTS")
      return this.reject("max_attempts", AuthErrorCode.OTP_MAX_ATTEMPTS)
    // Le code ne vaut que pour la destination à laquelle il a été envoyé.
    if (
      !this.hasher.matches(
        "otp-destination",
        destination,
        challenge.destinationHash,
      )
    ) {
      return this.reject("destination_changed", AuthErrorCode.OTP_INVALID)
    }
    if (!(await this.otps.registerAttempt(challenge))) {
      return this.reject("max_attempts", AuthErrorCode.OTP_MAX_ATTEMPTS)
    }
    const outcome = evaluateOtp(challenge, now, () =>
      this.hasher.matches(
        "otp-code",
        `${challenge.publicId}:${input.code}`,
        challenge.codeHash,
      ),
    )
    if (outcome !== "OK")
      return this.reject("wrong_code", AuthErrorCode.OTP_INVALID)

    const status = statusAfterVerification(user.status)
    await this.db.transaction(async (tx) => {
      if (!(await this.otps.consume(challenge.id, tx)))
        throw authError(AuthErrorCode.OTP_INVALID)
      await this.users.markContactVerified(user.id, channel, status, tx)
      await this.activity.audit(
        {
          action: settings.audit,
          actorId: user.id,
          entityType: "user",
          entityId: user.publicId,
          newValues: { status },
        },
        context,
        tx,
      )
    })
    this.activity.emit(settings.event, user.publicId, { status })
    this.activity.log("contact_verified", context, {
      user_id: user.publicId,
      session_id: auth.sessionId,
      channel,
    })
    return { status }
  }

  private async requireUser(auth: AuthenticatedUser): Promise<UserRecord> {
    const user = await this.users.findByPublicId(auth.id)
    if (!user) throw authError(AuthErrorCode.SESSION_REVOKED)
    return user
  }

  private destination(
    user: UserRecord,
    channel: ContactChannel,
  ): string | null {
    return channel === "PHONE" ? user.phone : user.email
  }

  private isVerified(user: UserRecord, channel: ContactChannel): boolean {
    return channel === "PHONE"
      ? user.phoneVerifiedAt !== null
      : user.emailVerifiedAt !== null
  }

  private reject(reason: string, code: AuthErrorCode): never {
    this.activity.metrics.auth.otpFailure.inc({ reason })
    throw authError(code)
  }
}
