import { Injectable } from "@nestjs/common"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import { IdentityConfig } from "../../identity.config"
import { SecretHasher } from "../../infrastructure/crypto/secret-hasher"
import { AuthRateLimiter } from "../../infrastructure/rate-limit/auth-rate-limiter"
import type { ClientContext } from "../client-context"

/**
 * Limites par palier (connexion, inscription, OTP, réinitialisation) appliquées
 * par IP et par identifiant. Les sujets sont réduits à une empreinte HMAC.
 */
@Injectable()
export class AuthThrottle {
  constructor(
    private readonly limiter: AuthRateLimiter,
    private readonly hasher: SecretHasher,
    private readonly config: IdentityConfig,
  ) {}

  key(bucket: string, subject: string): string {
    return `${bucket}:${this.hasher.hash("rate-limit", subject).slice(0, 32)}`
  }

  ip(context: ClientContext): string {
    return `ip:${context.ip ?? "unknown"}`
  }

  /** Lève 429 RATE_LIMITED quand la limite est dépassée. */
  async enforce(
    bucket: string,
    subject: string,
    limit: number,
    windowSeconds?: number,
  ): Promise<void> {
    const result = await this.limiter.hit(
      this.key(bucket, subject),
      limit,
      windowSeconds ?? this.config.rateLimitWindowSeconds,
    )
    if (!result.allowed)
      throw authError(AuthErrorCode.RATE_LIMITED, result.retryAfterSeconds)
  }

  /** Comme `enforce` sans lever : `false` si la limite est dépassée. */
  async allow(
    bucket: string,
    subject: string,
    limit: number,
    windowSeconds?: number,
  ): Promise<boolean> {
    const result = await this.limiter.hit(
      this.key(bucket, subject),
      limit,
      windowSeconds ?? this.config.rateLimitWindowSeconds,
    )
    return result.allowed
  }

  /** Blocage temporaire après trop d'échecs ; jamais de verrouillage permanent. */
  async assertNotLocked(
    bucket: string,
    subject: string,
    maxFailures: number,
  ): Promise<void> {
    const state = await this.limiter.peek(this.key(bucket, subject))
    if (state.count >= maxFailures) {
      throw authError(AuthErrorCode.TOO_MANY_ATTEMPTS, state.retryAfterSeconds)
    }
  }

  async recordFailure(
    bucket: string,
    subject: string,
    maxFailures: number,
    windowSeconds: number,
  ): Promise<void> {
    await this.limiter.hit(
      this.key(bucket, subject),
      maxFailures,
      windowSeconds,
    )
  }

  async clear(bucket: string, subject: string): Promise<void> {
    await this.limiter.reset(this.key(bucket, subject))
  }

  async acquireCooldown(subject: string, seconds: number) {
    return this.limiter.acquireCooldown(this.key("cooldown", subject), seconds)
  }
}
