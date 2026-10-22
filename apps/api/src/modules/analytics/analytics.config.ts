import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { LeadRule } from "@mon-appart/analytics"

/** Configuration Analytics, lue une fois (variables `ANALYTICS_*`). */
@Injectable()
export class AnalyticsConfig {
  readonly enabled: boolean
  readonly policyVersion: string
  readonly maxEventAgeMs: number
  /** Avance tolérée sur l'horloge serveur après correction du décalage. */
  readonly maxFutureSkewMs = 5 * 60_000
  readonly retentionDays: number
  readonly workerIntervalMs: number
  readonly lateDays: number
  readonly leadRule: LeadRule
  readonly attributionMs: number
  readonly minGroupSize: number
  /** Plage maximale d'une requête de lecture. */
  readonly maxRangeDays = 366
  readonly defaultRangeDays = 30

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    this.enabled = config.get<string>("ANALYTICS_ENABLED") !== "false"
    this.policyVersion =
      config.get<string>("ANALYTICS_POLICY_VERSION")?.trim() || "2026-10"
    this.maxEventAgeMs = num("ANALYTICS_MAX_EVENT_AGE_HOURS", 72) * 3_600_000
    this.retentionDays = num("ANALYTICS_RETENTION_DAYS", 395)
    this.workerIntervalMs =
      num("ANALYTICS_WORKER_INTERVAL_MINUTES", 15) * 60_000
    this.lateDays = num("ANALYTICS_LATE_DAYS", 3)
    const rule = config.get<string>("ANALYTICS_QUALIFIED_LEAD_RULE")
    this.leadRule =
      rule === "REPLY" || rule === "APPOINTMENT" ? rule : "REPLY_OR_APPOINTMENT"
    this.attributionMs = num("ANALYTICS_ATTRIBUTION_HOURS", 72) * 3_600_000
    this.minGroupSize = num("ANALYTICS_MIN_GROUP_SIZE", 5)
  }
}

/** Lots par minute et par IP, lus à la requête par le ThrottlerGuard. */
export const analyticsRateLimit = (): number =>
  Number(process.env.ANALYTICS_RATE_LIMIT) || 60
