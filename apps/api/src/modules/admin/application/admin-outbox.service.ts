import { HttpStatus, Injectable } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"
import { OutboxDispatcher } from "../../../common/events/outbox.dispatcher"
import { OutboxRepository } from "../../../common/events/outbox.repository"
import type { OutboxEventStatus } from "../../../generated/prisma/enums"
import { insertAuditLog } from "../../../common/audit/audit-log"
import { DatabaseService } from "../../../database/database.service"
import type { Actor, ClientContext } from "../../identity"

const STATUSES = new Set<OutboxEventStatus>([
  "PENDING",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "DEAD",
])

@Injectable()
export class AdminOutboxService {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly dispatcher: OutboxDispatcher,
    private readonly db: DatabaseService,
  ) {}

  async list(query: {
    status?: string
    eventType?: string
    cursor?: string
    limit?: number
  }) {
    const status = this.parseStatus(query.status)
    const rows = await this.outbox.list({
      ...(status ? { status } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit,
    })
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100)
    const hasMore = rows.length > limit
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toView)
    return {
      items,
      nextCursor: hasMore ? String(items[items.length - 1]?.id ?? "") : null,
    }
  }

  async stats() {
    const [groups, oldest] = await Promise.all([
      this.outbox.countByStatus(),
      this.outbox.oldestPending(),
    ])
    const byStatus: Record<string, number> = {}
    for (const row of groups) byStatus[row.status] = row._count._all
    return {
      byStatus,
      oldestPendingAt: oldest?.createdAt.toISOString() ?? null,
      oldestPendingType: oldest?.eventType ?? null,
    }
  }

  async replay(
    eventId: string,
    actor: Actor,
    context: ClientContext,
  ): Promise<{ eventId: string; queued: boolean }> {
    const ok = await this.outbox.replay(eventId)
    if (!ok) {
      throw new AppException(
        "OUTBOX_EVENT_NOT_REPLAYABLE",
        HttpStatus.CONFLICT,
        "Événement introuvable ou déjà rejouable",
      )
    }
    await insertAuditLog(this.db.client, {
      action: "OUTBOX_EVENT_REPLAYED",
      actorId: actor.userId,
      entityType: "outbox_event",
      entityId: eventId,
      newValues: { eventId },
      ipAddress: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    })
    await this.dispatcher.runOnce()
    return { eventId, queued: true }
  }

  private parseStatus(value?: string): OutboxEventStatus | undefined {
    if (!value) return undefined
    if (!STATUSES.has(value as OutboxEventStatus)) {
      throw new AppException(
        "INVALID_OUTBOX_STATUS",
        HttpStatus.BAD_REQUEST,
        "Statut d'événement inconnu",
      )
    }
    return value as OutboxEventStatus
  }
}

function toView(row: {
  id: bigint
  eventId: string
  eventType: string
  eventVersion: number
  producer: string
  aggregateType: string
  aggregateId: string
  occurredAt: Date
  createdAt: Date
  publishedAt: Date | null
  status: OutboxEventStatus
  attemptCount: number
  nextAttemptAt: Date
  lastError: string | null
  correlationId: string | null
}) {
  return {
    id: String(row.id),
    eventId: row.eventId,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    producer: row.producer,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lastError: row.lastError,
    correlationId: row.correlationId,
  }
}
