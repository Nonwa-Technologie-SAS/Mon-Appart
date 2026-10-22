import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

export type PaymentProviderSetting = "none" | "mock"

/**
 * Configuration Billing, lue une fois depuis l'environnement validé
 * (`parseApiEnv` refuse le simulateur hors développement et en live).
 */
@Injectable()
export class BillingConfig {
  readonly provider: PaymentProviderSetting
  readonly environment: "TEST" | "LIVE"
  /** Secret du simulateur ; jamais exposé, jamais journalisé. */
  readonly mockWebhookSecret: string | null
  readonly webhookToleranceSeconds: number
  readonly orderTtlMs: number
  readonly maxAttemptsPerOrder: number
  readonly graceDays: number
  readonly renewalWindowDays: number
  readonly renewalReminderDays: number
  /** 0 : la réconciliation en processus est désactivée (CLI seulement). */
  readonly workerIntervalMs: number

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    this.provider =
      config.get<string>("PAYMENT_PROVIDER") === "mock" ? "mock" : "none"
    this.environment =
      config.get<string>("PAYMENT_ENVIRONMENT") === "live" ? "LIVE" : "TEST"
    this.mockWebhookSecret =
      config.get<string>("PAYMENT_MOCK_WEBHOOK_SECRET") || null
    this.webhookToleranceSeconds = num("PAYMENT_WEBHOOK_TOLERANCE_SECONDS", 300)
    this.orderTtlMs = num("BILLING_ORDER_TTL_MINUTES", 60) * 60_000
    this.maxAttemptsPerOrder = num("BILLING_MAX_ATTEMPTS_PER_ORDER", 5)
    this.graceDays = num("BILLING_GRACE_DAYS", 3)
    this.renewalWindowDays = num("BILLING_RENEWAL_WINDOW_DAYS", 30)
    this.renewalReminderDays = num("BILLING_RENEWAL_REMINDER_DAYS", 7)
    this.workerIntervalMs = num("BILLING_WORKER_INTERVAL_MINUTES", 5) * 60_000
  }
}

/** Limites par minute et par IP, lues à la requête par le ThrottlerGuard. */
export const billingRateLimit = (): number =>
  Number(process.env.BILLING_RATE_LIMIT) || 30
export const billingWebhookRateLimit = (): number =>
  Number(process.env.BILLING_WEBHOOK_RATE_LIMIT) || 600
