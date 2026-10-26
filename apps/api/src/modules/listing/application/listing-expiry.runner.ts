import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { DatabaseService } from "../../../database/database.service"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { ListingEvent, LISTING_ENTITY } from "../domain/listing-events"
import { ListingRepository } from "../infrastructure/listing.repository"
import { ListingConfig } from "../listing.config"
import { ListingActivity } from "./listing-activity"

/**
 * Passe en EXPIRED les annonces PUBLISHED dont `expires_at` est dépassé.
 * Écrit l'outbox dans la même transaction (index, reco, analytics).
 */
@Injectable()
export class ListingExpiryRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ListingExpiryRunner.name)
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null
  private stopping = false

  constructor(
    private readonly db: DatabaseService,
    private readonly listings: ListingRepository,
    private readonly activity: ListingActivity,
    private readonly config: ListingConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.expiryWorker.enabled) return
    this.schedule(this.config.expiryWorker.pollMs)
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true
    if (this.timer) clearTimeout(this.timer)
    await this.running?.catch(() => undefined)
  }

  async runOnce(maxJobs = 200): Promise<number> {
    const batch = Math.min(this.config.expiryWorker.batchSize, maxJobs)
    const expired = await this.db.transaction(async (tx) => {
      const rows = await this.listings.claimExpired(batch, tx)
      for (const row of rows) {
        await this.listings.update(row.id, { status: "EXPIRED" }, tx)
        await this.listings.addHistory(
          {
            listingId: row.id,
            oldStatus: "PUBLISHED",
            newStatus: "EXPIRED",
            changedById: null,
            reason: "expired",
          },
          tx,
        )
        await this.activity.enqueue(tx, {
          name: ListingEvent.EXPIRED,
          producer: "listing",
          aggregateType: LISTING_ENTITY,
          aggregateId: row.publicId,
          payload: {
            listingId: row.publicId,
            propertyId: row.propertyPublicId,
            from: "PUBLISHED",
            to: "EXPIRED",
          },
        })
      }
      return rows.length
    })
    if (expired > 0) {
      await this.activity.flush()
      this.activity.metrics.catalog.listingStatusChanged.inc({ to: "EXPIRED" })
      this.logger.log(
        JSON.stringify({ action: "listings_expired", count: expired }),
      )
    }
    return expired
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.running = this.runOnce()
        .catch((error: unknown) => {
          this.logger.error(
            JSON.stringify({
              action: "listing_expiry_failed",
              error: safeErrorMessage(error),
            }),
          )
        })
        .finally(() => {
          this.running = null
          if (!this.stopping && this.config.expiryWorker.enabled) {
            this.schedule(this.config.expiryWorker.pollMs)
          }
        })
    }, delayMs)
  }
}
