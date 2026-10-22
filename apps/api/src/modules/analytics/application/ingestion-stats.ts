import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { safeErrorMessage } from "../../../common/http/safe-error"
import type { AnalyticsSource } from "../../../generated/prisma/enums"
import { MetricsService } from "../../../observability/metrics.service"
import { isoDay } from "../domain/ingestion-rules"
import {
  AnalyticsRepository,
  type StatEntry,
} from "../infrastructure/analytics.repository"

const FLUSH_MS = 10_000

/**
 * Compteurs d'ingestion agrégés en mémoire puis écrits par incréments
 * groupés : pas de verrou de ligne chaud par requête. Une perte limitée à
 * l'intervalle en cas d'arrêt brutal est acceptable (indicateur de qualité).
 */
@Injectable()
export class IngestionStats
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger("AnalyticsIngestionStats")
  private pending = new Map<string, StatEntry>()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_MS)
    this.timer.unref()
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.flush()
  }

  record(
    source: AnalyticsSource,
    outcome: StatEntry["outcome"],
    reason: string,
    count = 1,
    at = new Date(),
  ): void {
    if (count <= 0) return
    const day = isoDay(at)
    const key = `${day}|${source}|${outcome}|${reason}`
    const entry = this.pending.get(key)
    if (entry) entry.count += count
    else this.pending.set(key, { day, source, outcome, reason, count })

    const label = source.toLowerCase()
    this.metrics.analytics.events.inc({ source: label, outcome }, count)
    if (outcome === "rejected" || outcome === "ignored") {
      this.metrics.analytics.rejected.inc({ source: label, reason }, count)
    }
  }

  async flush(): Promise<void> {
    if (this.pending.size === 0) return
    const entries = [...this.pending.values()]
    this.pending = new Map()
    try {
      await this.repository.addIngestionStats(entries)
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          action: "analytics.stats_flush_failed",
          entries: entries.length,
          error: safeErrorMessage(error),
        }),
      )
    }
  }
}
