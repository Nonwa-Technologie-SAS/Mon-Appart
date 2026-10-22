import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { MediaEvent } from "../domain/media-events"
import { MediaRepository } from "../infrastructure/media.repository"
import { MediaConfig } from "../media.config"
import { MediaActivity } from "./media-activity"
import { MediaCleanupService } from "./media-cleanup.service"
import {
  MediaProcessingService,
  type JobOutcome,
} from "./media-processing.service"

/**
 * File de traitement portée par la table `media` (`next_attempt_at`), servie
 * par un worker dans le processus de l'API : aucun Redis requis. Plusieurs
 * instances peuvent tourner (SKIP LOCKED) ; un travail interrompu est repris
 * à l'expiration de son bail. Remplaçable par un worker BullMQ dédié sans
 * changer le modèle.
 */
@Injectable()
export class MediaJobRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger("MediaJobRunner")
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null
  private stopping = false
  private lastCleanup = 0

  constructor(
    private readonly media: MediaRepository,
    private readonly processing: MediaProcessingService,
    private readonly cleanup: MediaCleanupService,
    private readonly config: MediaConfig,
    private readonly activity: MediaActivity,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.worker.enabled) return
    this.schedule(this.config.worker.pollMs)
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true
    if (this.timer) clearTimeout(this.timer)
    await this.running?.catch(() => undefined)
  }

  /** Un envoi confirmé est traité sans attendre le prochain cycle. */
  @OnEvent(MediaEvent.UPLOADED, { async: true, suppressErrors: true })
  onUploaded(): void {
    if (this.config.worker.enabled && !this.running) this.schedule(0)
  }

  /**
   * Traite les travaux échus jusqu'à épuisement (borné). Utilisé par le
   * cycle du worker, par la CLI et par les tests (worker désactivé).
   */
  async runOnce(maxJobs = 100): Promise<Record<JobOutcome, number>> {
    const counts: Record<JobOutcome, number> = {
      READY: 0,
      REJECTED: 0,
      RETRY: 0,
      FAILED: 0,
      LOST: 0,
    }
    const leaseSeconds = Math.ceil((this.config.worker.timeoutMs * 2) / 1_000)
    let processed = 0
    while (processed < maxJobs && !this.stopping) {
      const jobs = await this.media.claimJobs(
        Math.min(this.config.worker.concurrency, maxJobs - processed),
        leaseSeconds,
      )
      if (jobs.length === 0) break
      const outcomes = await Promise.all(
        jobs.map((job) =>
          this.processing.run(job).catch((error: unknown) => {
            this.logger.error(
              JSON.stringify({
                action: "media.job_crashed",
                error: safeErrorMessage(error),
              }),
            )
            return "LOST" as const
          }),
        ),
      )
      for (const outcome of outcomes) counts[outcome]++
      processed += jobs.length
    }
    return counts
  }

  /** Expiration des sessions et purge échue, au plus une fois par intervalle. */
  async runMaintenance(force = false): Promise<void> {
    if (
      !force &&
      Date.now() - this.lastCleanup < this.config.worker.cleanupIntervalMs
    ) {
      return
    }
    this.lastCleanup = Date.now()
    await this.cleanup.expireSessions()
    await this.cleanup.purgeDue()
  }

  private schedule(delay: number): void {
    if (this.stopping) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.running = this.cycle().finally(() => {
        this.running = null
        this.schedule(this.config.worker.pollMs)
      })
    }, delay)
    this.timer.unref()
  }

  private async cycle(): Promise<void> {
    try {
      await this.runOnce()
      await this.runMaintenance()
      this.media
        .countPendingJobs()
        .then((count) => this.activity.metrics.media.pendingJobs.set(count))
        .catch(() => undefined)
    } catch (error) {
      // Base indisponible : on réessaie au cycle suivant, sans bruit excessif.
      this.logger.warn(
        JSON.stringify({
          action: "media.worker_cycle_failed",
          error: safeErrorMessage(error),
        }),
      )
    }
  }
}
