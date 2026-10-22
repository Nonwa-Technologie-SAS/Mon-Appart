import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import type { ValidityConfig } from "./domain/verification-requirements"

/** Configuration Trust, lue une fois depuis l'environnement validé. */
@Injectable()
export class TrustConfig {
  readonly validity: ValidityConfig
  readonly documentRetentionDays: number
  readonly maxDocuments: number
  readonly reportReviewThreshold: number
  readonly priceChangeAlertRatio: number
  readonly reportDailyLimit: number
  readonly listingBurstThreshold: number
  readonly listingBurstWindowHours: number
  /** 0 : la tâche de maintenance en processus est désactivée (CLI seulement). */
  readonly maintenanceIntervalMs: number

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    this.validity = {
      identityDays: num("TRUST_IDENTITY_VALIDITY_DAYS", 730),
      propertyDays: num("TRUST_PROPERTY_VALIDITY_DAYS", 365),
      agencyDays: num("TRUST_AGENCY_VALIDITY_DAYS", 365),
      listingCheckDays: num("TRUST_LISTING_CHECK_VALIDITY_DAYS", 180),
    }
    this.documentRetentionDays = num("TRUST_DOCUMENT_RETENTION_DAYS", 365)
    this.maxDocuments = num("TRUST_MAX_DOCUMENTS_PER_VERIFICATION", 10)
    this.reportReviewThreshold = num("TRUST_REPORT_REVIEW_THRESHOLD", 3)
    this.priceChangeAlertRatio = num("TRUST_PRICE_CHANGE_ALERT_RATIO", 0.5)
    this.reportDailyLimit = num("TRUST_REPORT_DAILY_LIMIT", 20)
    this.listingBurstThreshold = num("TRUST_LISTING_BURST_THRESHOLD", 8)
    this.listingBurstWindowHours = num("TRUST_LISTING_BURST_WINDOW_HOURS", 24)
    this.maintenanceIntervalMs =
      num("TRUST_MAINTENANCE_INTERVAL_MINUTES", 60) * 60_000
  }
}

/** Limites par minute et par IP, lues à la requête par le ThrottlerGuard. */
export const trustReportRateLimit = (): number =>
  Number(process.env.TRUST_REPORT_RATE_LIMIT) || 10
export const trustMutationRateLimit = (): number =>
  Number(process.env.TRUST_MUTATION_RATE_LIMIT) || 30
