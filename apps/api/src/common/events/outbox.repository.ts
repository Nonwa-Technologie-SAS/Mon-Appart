import { Injectable } from "@nestjs/common"

import { DatabaseService, type Db } from "../../database/database.service"
import { Prisma } from "../../generated/prisma/client"
import type { OutboxEventStatus } from "../../generated/prisma/enums"
import type { OutboxDraft } from "./event-schema"
import { DEFAULT_EVENT_VERSION } from "./outbox.constants"

export interface ClaimedOutbox {
  id: bigint
  eventId: string
  eventType: string
  eventVersion: number
  producer: string
  aggregateType: string
  aggregateId: string
  payload: Prisma.JsonValue
  occurredAt: Date
  attemptCount: number
  correlationId: string | null
  causationId: string | null
  traceId: string | null
}

export interface OutboxListQuery {
  status?: OutboxEventStatus
  eventType?: string
  cursor?: string
  limit?: number
}

@Injectable()
export class OutboxRepository {
  constructor(private readonly db: DatabaseService) {}

  async insert(
    tx: Db,
    draft: OutboxDraft & { eventId: string; occurredAt: Date },
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        eventId: draft.eventId,
        eventType: draft.name,
        eventVersion: draft.eventVersion ?? DEFAULT_EVENT_VERSION,
        producer: draft.producer,
        aggregateType: draft.aggregateType,
        aggregateId: draft.aggregateId,
        payload: draft.payload as Prisma.InputJsonValue,
        occurredAt: draft.occurredAt,
        correlationId: draft.correlationId ?? null,
        causationId: draft.causationId ?? null,
        traceId: draft.traceId ?? null,
      },
    })
  }

  async claim(limit: number, leaseSeconds: number): Promise<ClaimedOutbox[]> {
    const rows = await this.db.client.$queryRaw<ClaimedOutbox[]>`
      UPDATE outbox_events
      SET status = 'PUBLISHING',
          attempt_count = attempt_count + 1,
          next_attempt_at = now() + ${leaseSeconds}::int * interval '1 second'
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE next_attempt_at <= now()
          AND status IN ('PENDING', 'PUBLISHING')
        ORDER BY next_attempt_at, id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        event_id AS "eventId",
        event_type AS "eventType",
        event_version AS "eventVersion",
        producer,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        payload,
        occurred_at AS "occurredAt",
        attempt_count AS "attemptCount",
        correlation_id AS "correlationId",
        causation_id AS "causationId",
        trace_id AS "traceId"
    `
    return rows
  }

  async markPublished(job: ClaimedOutbox): Promise<boolean> {
    const result = await this.db.client.outboxEvent.updateMany({
      where: {
        id: job.id,
        status: "PUBLISHING",
        attemptCount: job.attemptCount,
      },
      data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null },
    })
    return result.count === 1
  }

  async markRetry(
    job: ClaimedOutbox,
    nextAttemptAt: Date,
    lastError: string,
  ): Promise<void> {
    await this.db.client.outboxEvent.updateMany({
      where: {
        id: job.id,
        status: "PUBLISHING",
        attemptCount: job.attemptCount,
      },
      data: { status: "PENDING", nextAttemptAt, lastError },
    })
  }

  async markDead(job: ClaimedOutbox, lastError: string): Promise<void> {
    await this.db.client.outboxEvent.updateMany({
      where: {
        id: job.id,
        status: "PUBLISHING",
        attemptCount: job.attemptCount,
      },
      data: { status: "DEAD", lastError, nextAttemptAt: new Date() },
    })
  }

  async replay(eventId: string): Promise<boolean> {
    const result = await this.db.client.outboxEvent.updateMany({
      where: { eventId, status: { in: ["DEAD", "FAILED"] } },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(),
        lastError: null,
      },
    })
    return result.count === 1
  }

  async list(query: OutboxListQuery) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100)
    const cursorId = query.cursor ? BigInt(query.cursor) : undefined
    return this.db.client.outboxEvent.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.eventType ? { eventType: query.eventType } : {}),
        ...(cursorId ? { id: { lt: cursorId } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit + 1,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        eventVersion: true,
        producer: true,
        aggregateType: true,
        aggregateId: true,
        occurredAt: true,
        createdAt: true,
        publishedAt: true,
        status: true,
        attemptCount: true,
        nextAttemptAt: true,
        lastError: true,
        correlationId: true,
      },
    })
  }

  countByStatus() {
    return this.db.client.outboxEvent.groupBy({
      by: ["status"],
      _count: { _all: true },
    })
  }

  oldestPending() {
    return this.db.client.outboxEvent.findFirst({
      where: { status: { in: ["PENDING", "PUBLISHING"] } },
      orderBy: { nextAttemptAt: "asc" },
      select: { nextAttemptAt: true, createdAt: true, eventType: true },
    })
  }

  async purgePublished(before: Date): Promise<number> {
    const result = await this.db.client.outboxEvent.deleteMany({
      where: { status: "PUBLISHED", publishedAt: { lt: before } },
    })
    return result.count
  }
}
