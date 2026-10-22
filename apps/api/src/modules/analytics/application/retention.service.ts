import { Injectable } from "@nestjs/common"

import { MetricsService } from "../../../observability/metrics.service"
import { AnalyticsConfig } from "../analytics.config"
import { addDays, utcDay } from "../domain/ingestion-rules"
import { AnalyticsRepository } from "../infrastructure/analytics.repository"

const BATCH = 5_000
const MAX_BATCHES = 200

/**
 * Suppression des événements bruts au-delà de la rétention, par petits lots
 * (pas de verrou long, pas de gonflement du WAL). Les agrégats journaliers et
 * par annonce sont conservés.
 */
@Injectable()
export class RetentionService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly config: AnalyticsConfig,
    private readonly metrics: MetricsService,
  ) {}

  cutoff(now = new Date()): Date {
    return addDays(utcDay(now), 1 - this.config.retentionDays)
  }

  async purge(now = new Date()): Promise<number> {
    const before = this.cutoff(now).toISOString()
    let total = 0
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const deleted = await this.repository.client.$executeRaw`
        DELETE FROM analytics_events
        WHERE id IN (
          SELECT id FROM analytics_events
          WHERE occurred_at < ${before}::timestamptz
          LIMIT ${BATCH}
        )
      `
      total += deleted
      if (deleted < BATCH) break
    }
    if (total > 0) this.metrics.analytics.purged.inc(total)
    return total
  }
}
