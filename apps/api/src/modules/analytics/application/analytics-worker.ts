import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { MetricsService } from "../../../observability/metrics.service"
import { AnalyticsConfig } from "../analytics.config"
import { AggregationService } from "./aggregation.service"
import { RetentionService } from "./retention.service"

/**
 * Tâche périodique dans l'API (comme Media et Notifications) : agrégation
 * journalière puis purge. Sûre en multi-instance (verrou consultatif par
 * jour, suppressions idempotentes). `ANALYTICS_WORKER_INTERVAL_MINUTES=0`
 * la désactive ; la CLI reste disponible.
 */
@Injectable()
export class AnalyticsWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger("AnalyticsWorker")
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null

  constructor(
    private readonly aggregation: AggregationService,
    private readonly retention: RetentionService,
    private readonly config: AnalyticsConfig,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.workerIntervalMs <= 0) return
    this.timer = setInterval(() => {
      if (this.running) return
      this.running = this.runOnce()
        .catch((error: unknown) =>
          this.logger.error(
            JSON.stringify({
              action: "analytics.worker_failed",
              error: safeErrorMessage(error),
            }),
          ),
        )
        .finally(() => {
          this.running = null
        })
    }, this.config.workerIntervalMs)
    this.timer.unref()
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.running?.catch(() => undefined)
  }

  async runOnce(now = new Date()): Promise<{
    aggregatedDays: number
    purged: number
  }> {
    const aggregated = await this.aggregation.run(now)
    let purged = 0
    try {
      purged = await this.retention.purge(now)
      this.metrics.analytics.jobRuns.inc({ job: "purge", outcome: "ok" })
    } catch (error) {
      this.metrics.analytics.jobRuns.inc({ job: "purge", outcome: "error" })
      throw error
    }
    if (aggregated.days.length || purged) {
      this.logger.log(
        JSON.stringify({
          action: "analytics.worker_run",
          aggregated_days: aggregated.days.length,
          skipped_days: aggregated.skipped.length,
          purged,
        }),
      )
    }
    return { aggregatedDays: aggregated.days.length, purged }
  }
}
