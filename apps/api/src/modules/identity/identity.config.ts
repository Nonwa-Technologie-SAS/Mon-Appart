import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { parseDuration } from "@mon-appart/config"
import { createHmac } from "node:crypto"

import type { Argon2Options } from "../../common/security/password-hasher"

/** Configuration Identity, lue une seule fois depuis l'environnement validé. */
@Injectable()
export class IdentityConfig {
  readonly appEnv: string
  readonly accessTokenSecret: string
  readonly accessTokenTtlMs: number
  readonly refreshTokenTtlMs: number
  readonly passwordResetTtlMs: number
  readonly otpLength: number
  readonly otpTtlMs: number
  readonly otpMaxAttempts: number
  readonly otpResendCooldownSeconds: number
  readonly maxLoginAttempts: number
  readonly loginFailureWindowSeconds: number
  readonly rateLimitWindowSeconds: number
  readonly loginRateLimit: number
  readonly registerRateLimit: number
  readonly otpRateLimit: number
  readonly resetRateLimit: number
  readonly argon2: Argon2Options
  readonly webAppUrl: string
  readonly secureCookies: boolean
  readonly devPrintCodes: boolean
  /** Jours avant suppression des sessions expirées ou révoquées. */
  readonly sessionRetentionDays: number
  /** 0 : pas de tâche périodique en processus (CLI seulement). */
  readonly retentionIntervalMs: number
  /**
   * Clé HMAC des refresh tokens, OTP et jetons de réinitialisation, dérivée de
   * JWT_REFRESH_SECRET avec séparation de domaine.
   */
  readonly hashKey: Buffer

  constructor(config: ConfigService) {
    const str = (key: string, fallback: string) => {
      const value = config.get<string | number>(key)
      return value === undefined || value === "" ? fallback : String(value)
    }
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }

    this.appEnv = str("APP_ENV", "local")
    this.accessTokenSecret = config.getOrThrow<string>("JWT_SECRET")
    this.accessTokenTtlMs = parseDuration(str("JWT_ACCESS_TTL", "15m"))
    this.refreshTokenTtlMs = parseDuration(str("JWT_REFRESH_TTL", "30d"))
    this.passwordResetTtlMs = parseDuration(str("PASSWORD_RESET_TTL", "30m"))
    this.otpLength = num("OTP_LENGTH", 6)
    this.otpTtlMs = parseDuration(str("OTP_TTL", "5m"))
    this.otpMaxAttempts = num("OTP_MAX_ATTEMPTS", 5)
    this.otpResendCooldownSeconds = num("OTP_RESEND_COOLDOWN", 60)
    this.maxLoginAttempts = num("AUTH_MAX_LOGIN_ATTEMPTS", 5)
    this.loginFailureWindowSeconds = num("AUTH_LOGIN_FAILURE_WINDOW", 900)
    this.rateLimitWindowSeconds = num("AUTH_RATE_LIMIT_WINDOW", 60)
    this.loginRateLimit = num("AUTH_LOGIN_RATE_LIMIT", 10)
    this.registerRateLimit = num("AUTH_REGISTER_RATE_LIMIT", 5)
    this.otpRateLimit = num("AUTH_OTP_RATE_LIMIT", 5)
    this.resetRateLimit = num("AUTH_RESET_RATE_LIMIT", 5)
    this.argon2 = {
      memoryCost: num("ARGON2_MEMORY_COST", 19_456),
      timeCost: num("ARGON2_TIME_COST", 2),
      parallelism: num("ARGON2_PARALLELISM", 1),
    }
    this.webAppUrl = str("WEB_APP_URL", "http://localhost:3000").replace(
      /\/+$/,
      "",
    )
    this.secureCookies = !["local", "test"].includes(this.appEnv)
    this.devPrintCodes =
      this.appEnv === "local" && str("AUTH_DEV_PRINT_CODES", "false") === "true"
    this.sessionRetentionDays = num("IDENTITY_SESSION_RETENTION_DAYS", 30)
    this.retentionIntervalMs =
      num("IDENTITY_RETENTION_INTERVAL_MINUTES", 0) * 60_000
    this.hashKey = createHmac(
      "sha256",
      config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update("mon-appart:identity:hmac:v1")
      .digest()
  }

  get accessTokenTtlSeconds(): number {
    return Math.floor(this.accessTokenTtlMs / 1000)
  }
}
