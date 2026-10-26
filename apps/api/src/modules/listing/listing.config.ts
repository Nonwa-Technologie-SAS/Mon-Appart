import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import {
  parsePublicationRequirements,
  type PublicationRequirement,
} from "../trust/publication"

@Injectable()
export class ListingConfig {
  /** Publication soumise à un modérateur (DRAFT → PENDING_REVIEW). */
  readonly moderationRequired: boolean
  readonly defaultDurationDays: number
  /** Vérifications exigées avant publication ; vide par défaut. */
  readonly publicationRequirements: PublicationRequirement[]
  /** Délai de grâce d'un abonnement échu, pris en compte par le quota. */
  readonly billingGraceDays: number
  readonly expiryWorker: {
    enabled: boolean
    pollMs: number
    batchSize: number
  }

  constructor(config: ConfigService) {
    const grace = Number(config.get("BILLING_GRACE_DAYS") ?? 3)
    this.billingGraceDays = Number.isInteger(grace) && grace >= 0 ? grace : 3
    this.moderationRequired =
      String(config.get("LISTING_MODERATION_REQUIRED") ?? "false") === "true"
    const days = Number(config.get("LISTING_DEFAULT_DURATION_DAYS") ?? 90)
    this.defaultDurationDays = Number.isInteger(days) && days > 0 ? days : 90
    this.publicationRequirements = parsePublicationRequirements(
      config.get<string>("LISTING_PUBLICATION_REQUIREMENTS"),
    )
    const poll = Number(config.get("LISTING_EXPIRY_POLL_MS") ?? 60_000)
    const batch = Number(config.get("LISTING_EXPIRY_BATCH_SIZE") ?? 50)
    this.expiryWorker = {
      enabled:
        String(config.get("LISTING_EXPIRY_WORKER_ENABLED") ?? "true") ===
        "true",
      pollMs: Number.isInteger(poll) && poll >= 5_000 ? poll : 60_000,
      batchSize: Number.isInteger(batch) && batch > 0 ? batch : 50,
    }
  }
}
