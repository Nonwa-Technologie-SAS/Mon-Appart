import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"

import { safeErrorMessage } from "../http/safe-error"
import { MetricsService } from "../../observability/metrics.service"
import type { DomainEvent } from "./domain-event"
import { isPermanentOutboxError, outboxRetryDelayMs } from "./event-retry"
import { sanitizeOutboxError } from "./event-schema"
import { DomainEventPublisher } from "./domain-event.publisher"
import { OutboxConfig } from "./outbox.config"
import { OUTBOX_QUEUED } from "./outbox.constants"
import { OutboxRepository, type ClaimedOutbox } from "./outbox.repository"

/**
 * Relais Outbox → bus en processus. Réclame avec SKIP LOCKED, publie hors
 * transaction PostgreSQL, puis marque PUBLISHED. Livraison at-least-once.
 */
@Injectable()
export class OutboxDispatcher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxDispatcher.name)
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null
  private stopping = false
  private lastPurge = 0
  private schemaMissingLogged = false

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly publisher: DomainEventPublisher,
    private readonly config: OutboxConfig,
    private readonly metrics: MetricsService,
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

  @OnEvent(OUTBOX_QUEUED, { async: true, suppressErrors: true })
  onQueued(): void {
    this.wake()
  }

  wake(): void {
    if (this.stopping) return
    if (!this.running) this.schedule(0)
  }

  async runOnce(maxJobs = 200): Promise<number> {
    const { batchSize, maxAttempts, retryBaseSeconds } = this.config.worker
    const leaseSeconds = 30
    let published = 0
    let processed = 0
    while (processed < maxJobs && !this.stopping) {
      const jobs = await this.outbox.claim(
        Math.min(batchSize, maxJobs - processed),
        leaseSeconds,
      )
      if (jobs.length === 0) break
      for (const job of jobs) {
        processed += 1
        const outcome = await this.publishOne(
          job,
          maxAttempts,
          retryBaseSeconds,
        )
        if (outcome === "published") published += 1
      }
    }
    this.schemaMissingLogged = false
    await this.maybePurge()
    await this.refreshGauges()
    return published
  }

  private async publishOne(
    job: ClaimedOutbox,
    maxAttempts: number,
    retryBaseSeconds: number,
  ): Promise<"published" | "retry" | "dead"> {
    const started = Date.now()
    try {
      this.publisher.publish(toDomainEvent(job))
      const kept = await this.outbox.markPublished(job)
      if (!kept) {
        this.logger.warn(
          JSON.stringify({
            action: "outbox_lease_lost",
            event_id: job.eventId,
            event_type: job.eventType,
          }),
        )
      }
      this.metrics.outbox.published.inc({
        event_type: metricType(job.eventType),
      })
      this.metrics.outbox.publishLatency.observe(
        { event_type: metricType(job.eventType) },
        Date.now() - started,
      )
      return "published"
    } catch (error) {
      const lastError = sanitizeOutboxError(error)
      const permanent = isPermanentOutboxError(error)
      const exhausted = job.attemptCount >= maxAttempts
      this.logger.warn(
        JSON.stringify({
          action: "outbox_publish_failed",
          event_id: job.eventId,
          event_type: job.eventType,
          attempt: job.attemptCount,
          error: lastError,
        }),
      )
      this.metrics.outbox.retries.inc({
        event_type: metricType(job.eventType),
        reason: permanent ? "permanent" : "transient",
      })
      if (permanent || exhausted) {
        await this.outbox.markDead(job, lastError)
        this.metrics.outbox.dead.inc({ event_type: metricType(job.eventType) })
        return "dead"
      }
      await this.outbox.markRetry(
        job,
        new Date(
          Date.now() + outboxRetryDelayMs(job.attemptCount, retryBaseSeconds),
        ),
        lastError,
      )
      return "retry"
    }
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.running = this.runOnce()
        .catch((error: unknown) => {
          const missing = isMissingRelation(error)
          if (missing && this.schemaMissingLogged) return
          if (missing) this.schemaMissingLogged = true
          this.logger.error(
            JSON.stringify({
              action: "outbox_dispatch_failed",
              error: missing
                ? "table outbox_events absente (appliquer la migration)"
                : safeErrorMessage(error),
            }),
          )
        })
        .finally(() => {
          this.running = null
          if (!this.stopping && this.config.worker.enabled) {
            this.schedule(
              this.schemaMissingLogged
                ? Math.max(this.config.worker.pollMs, 60_000)
                : this.config.worker.pollMs,
            )
          }
        })
    }, delayMs)
  }

  private async maybePurge(): Promise<void> {
    const days = this.config.worker.retentionDays
    if (days <= 0) return
    const now = Date.now()
    if (now - this.lastPurge < 3_600_000) return
    this.lastPurge = now
    const before = new Date(now - days * 86_400_000)
    const deleted = await this.outbox.purgePublished(before)
    if (deleted > 0) {
      this.logger.log(
        JSON.stringify({ action: "outbox_purged", count: deleted }),
      )
    }
  }

  private async refreshGauges(): Promise<void> {
    try {
      const [groups, oldest] = await Promise.all([
        this.outbox.countByStatus(),
        this.outbox.oldestPending(),
      ])
      let pending = 0
      let dead = 0
      for (const row of groups) {
        if (row.status === "PENDING" || row.status === "PUBLISHING") {
          pending += row._count._all
        }
        if (row.status === "DEAD") dead = row._count._all
      }
      this.metrics.outbox.pending.set(pending)
      this.metrics.outbox.deadLetters.set(dead)
      if (oldest) {
        this.metrics.outbox.oldestAgeSeconds.set(
          Math.max(0, (Date.now() - oldest.createdAt.getTime()) / 1_000),
        )
      } else {
        this.metrics.outbox.oldestAgeSeconds.set(0)
      }
    } catch {
      // Les jauges ne doivent pas faire échouer la publication.
    }
  }
}

function toDomainEvent(job: ClaimedOutbox): DomainEvent<object> {
  const payload =
    job.payload &&
    typeof job.payload === "object" &&
    !Array.isArray(job.payload)
      ? (job.payload as object)
      : {}
  return {
    id: job.eventId,
    name: job.eventType,
    occurredAt: job.occurredAt.toISOString(),
    aggregateId: job.aggregateId,
    payload,
    eventVersion: job.eventVersion,
    publishedAt: new Date().toISOString(),
    producer: job.producer,
    aggregateType: job.aggregateType,
    correlationId: job.correlationId,
    causationId: job.causationId,
    traceId: job.traceId,
  }
}

function isMissingRelation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("42P01") || /relation "[^"]+" does not exist/.test(message)
  )
}

function metricType(eventType: string): string {
  const parts = eventType.split(".")
  return parts.slice(0, 2).join(".") || "unknown"
}
