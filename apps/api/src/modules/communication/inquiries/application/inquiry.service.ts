import { Injectable } from "@nestjs/common"
import { Prisma } from "../../../../generated/prisma/client"
import type {
  InquiryLeadStage,
  InquiryLostReason,
  InquiryStatus,
} from "../../../../generated/prisma/client"

import type { Actor, ClientContext } from "../../../identity"
import { CommunicationActivity } from "../../communication-activity"
import { communicationError } from "../../domain/communication-errors"
import {
  CommunicationAuditAction,
  CommunicationEvent,
  INQUIRY_ENTITY,
} from "../../domain/communication-events"
import { ConversationRepository } from "../../messaging/infrastructure/conversation.repository"
import { displayName } from "../../messaging/domain/message-rules"
import { serialize } from "../../presentation/serialize"
import {
  canTransitionInquiryStage,
  suggestedStageAfterFirstReply,
  suggestedStageAfterVisit,
} from "../domain/inquiry-lead-stage"
import {
  prioritizeInquiry,
  type InquiryPriorityResult,
} from "../domain/inquiry-priority"

export interface InquiryListQuery {
  cursor?: string
  listingId?: string
  stage?: InquiryLeadStage
  status?: InquiryStatus
  assignee?: "me" | "unassigned" | "all"
  q?: string
  take?: number
}

const inquirySelect = {
  id: true,
  publicId: true,
  type: true,
  status: true,
  stage: true,
  message: true,
  nextAction: true,
  nextActionAt: true,
  budgetAmount: true,
  desiredZone: true,
  desiredMoveAt: true,
  lostReason: true,
  firstRespondedAt: true,
  qualifiedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { publicId: true, firstName: true, lastName: true } },
  assignee: { select: { publicId: true, firstName: true, lastName: true } },
  listing: {
    select: {
      publicId: true,
      title: true,
      listingType: true,
      status: true,
      prices: {
        where: { validTo: null },
        take: 1,
        select: { amount: true, currency: true, period: true },
      },
    },
  },
  conversation: { select: { publicId: true, lastActivityAt: true } },
  appointments: {
    select: { publicId: true, status: true, scheduledAt: true },
    orderBy: { scheduledAt: "desc" as const },
    take: 5,
  },
} satisfies Prisma.InquirySelect

type InquiryRow = Prisma.InquiryGetPayload<{ select: typeof inquirySelect }>

@Injectable()
export class InquiryService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly activity: CommunicationActivity,
  ) {}

  async list(actor: Actor, query: InquiryListQuery) {
    const take = Math.min(query.take ?? 30, 50)
    const cursorRow = query.cursor
      ? await this.conversations.client.inquiry.findUnique({
          where: { publicId: query.cursor },
          select: { createdAt: true, id: true },
        })
      : null

    const listingWhere =
      query.listingId || query.q
        ? {
            listing: {
              ...(query.listingId ? { publicId: query.listingId } : {}),
              ...(query.q
                ? { title: { contains: query.q, mode: "insensitive" as const } }
                : {}),
            },
          }
        : {}

    const rows = await this.conversations.client.inquiry.findMany({
      where: {
        property: {
          ownerships: { some: { ownerId: actor.userId, isCurrent: true } },
        },
        ...listingWhere,
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.assignee === "me" ? { assigneeId: actor.userId } : {}),
        ...(query.assignee === "unassigned" ? { assigneeId: null } : {}),
        ...(cursorRow
          ? {
              OR: [
                { createdAt: { lt: cursorRow.createdAt } },
                { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: inquirySelect,
    })
    const hasMore = rows.length > take
    const slice = hasMore ? rows.slice(0, take) : rows
    const now = new Date()
    const items = slice.map((row) => this.toListView(row, now))
    return {
      items: serialize(items),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    }
  }

  async get(actor: Actor, publicId: string) {
    const row = await this.requireManaged(actor.userId, publicId, true)
    const notes = await this.conversations.client.inquiryNote.findMany({
      where: { inquiryId: row.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { publicId: true, firstName: true, lastName: true } },
      },
    })
    const history =
      await this.conversations.client.inquiryStageHistory.findMany({
        where: { inquiryId: row.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: {
            select: { publicId: true, firstName: true, lastName: true },
          },
        },
      })
    return serialize({
      ...this.toListView(row, new Date()),
      message: row.message,
      desiredZone: row.desiredZone,
      desiredMoveAt: row.desiredMoveAt,
      lostReason: row.lostReason,
      notes: notes.map((note) => ({
        id: note.publicId,
        body: note.body,
        createdAt: note.createdAt,
        author: {
          id: note.author.publicId,
          displayName: displayName(note.author),
        },
      })),
      stageHistory: history.map((item) => ({
        fromStage: item.fromStage,
        toStage: item.toStage,
        reason: item.reason,
        createdAt: item.createdAt,
        author: {
          id: item.author.publicId,
          displayName: displayName(item.author),
        },
      })),
    })
  }

  async update(
    actor: Actor,
    publicId: string,
    input: {
      stage?: InquiryLeadStage
      nextAction?: string | null
      nextActionAt?: Date | null
      budgetAmount?: number | null
      desiredZone?: string | null
      desiredMoveAt?: Date | null
      lostReason?: InquiryLostReason | null
      assigneePublicId?: string | null
    },
    client: ClientContext,
  ) {
    const existing = await this.requireManaged(actor.userId, publicId, false)
    if (
      input.stage &&
      !canTransitionInquiryStage(existing.stage, input.stage)
    ) {
      throw communicationError(
        "INQUIRY_INVALID_TRANSITION",
        `${existing.stage} → ${input.stage}`,
      )
    }
    if (input.stage === "LOST" && !input.lostReason && !existing.lostReason) {
      throw communicationError(
        "INQUIRY_INVALID_TRANSITION",
        "Motif de perte requis",
      )
    }

    let assigneeId: bigint | null | undefined
    if (input.assigneePublicId === null) assigneeId = null
    else if (input.assigneePublicId) {
      const user = await this.conversations.client.user.findUnique({
        where: { publicId: input.assigneePublicId },
        select: { id: true },
      })
      if (!user) throw communicationError("INQUIRY_ASSIGNEE_INVALID")
      const manager = await this.conversations.isCurrentManager(
        existing.propertyId,
        user.id,
      )
      if (!manager) throw communicationError("INQUIRY_ASSIGNEE_INVALID")
      assigneeId = user.id
    }

    const updated = await this.conversations.transaction(async (tx) => {
      const saved = await tx.inquiry.update({
        where: { id: existing.id },
        data: {
          ...(input.stage ? { stage: input.stage } : {}),
          ...(input.stage === "QUALIFIED" && !existing.qualifiedAt
            ? { qualifiedAt: new Date() }
            : {}),
          ...(input.nextAction !== undefined
            ? { nextAction: input.nextAction?.trim().slice(0, 255) ?? null }
            : {}),
          ...(input.nextActionAt !== undefined
            ? { nextActionAt: input.nextActionAt }
            : {}),
          ...(input.budgetAmount !== undefined
            ? {
                budgetAmount:
                  input.budgetAmount === null
                    ? null
                    : BigInt(Math.round(input.budgetAmount)),
              }
            : {}),
          ...(input.desiredZone !== undefined
            ? { desiredZone: input.desiredZone?.trim().slice(0, 120) ?? null }
            : {}),
          ...(input.desiredMoveAt !== undefined
            ? { desiredMoveAt: input.desiredMoveAt }
            : {}),
          ...(input.lostReason !== undefined
            ? { lostReason: input.lostReason }
            : {}),
          ...(assigneeId !== undefined ? { assigneeId } : {}),
          updatedAt: new Date(),
        },
        select: inquirySelect,
      })
      if (input.stage && input.stage !== existing.stage) {
        await tx.inquiryStageHistory.create({
          data: {
            inquiryId: existing.id,
            fromStage: existing.stage,
            toStage: input.stage,
            authorId: actor.userId,
            reason: input.lostReason ?? null,
          },
        })
        await this.activity.audit(
          {
            action: CommunicationAuditAction.INQUIRY_STAGE_CHANGED,
            actorId: actor.userId,
            entityType: INQUIRY_ENTITY,
            entityId: publicId,
            newValues: { from: existing.stage, to: input.stage },
          },
          client,
          tx,
        )
      }
      if (assigneeId !== undefined) {
        await this.activity.audit(
          {
            action: CommunicationAuditAction.INQUIRY_ASSIGNED,
            actorId: actor.userId,
            entityType: INQUIRY_ENTITY,
            entityId: publicId,
            newValues: { assigned: Boolean(assigneeId) },
          },
          client,
          tx,
        )
      }
      return saved
    })

    if (input.stage && input.stage !== existing.stage) {
      this.activity.emit(CommunicationEvent.INQUIRY_STAGE_CHANGED, publicId, {
        inquiryId: publicId,
        from: existing.stage,
        to: input.stage,
      })
    }
    if (assigneeId !== undefined) {
      this.activity.emit(CommunicationEvent.INQUIRY_ASSIGNED, publicId, {
        inquiryId: publicId,
        assigned: Boolean(assigneeId),
      })
    }
    return serialize(this.toListView(updated, new Date()))
  }

  async addNote(
    actor: Actor,
    publicId: string,
    body: string,
    client: ClientContext,
  ) {
    const text = body.trim()
    if (text.length < 2 || text.length > 2000) {
      throw communicationError("INQUIRY_NOTE_INVALID")
    }
    const existing = await this.requireManaged(actor.userId, publicId, false)
    await this.conversations.transaction(async (tx) => {
      await tx.inquiryNote.create({
        data: { inquiryId: existing.id, authorId: actor.userId, body: text },
      })
      await this.activity.audit(
        {
          action: CommunicationAuditAction.INQUIRY_NOTE_ADDED,
          actorId: actor.userId,
          entityType: INQUIRY_ENTITY,
          entityId: publicId,
        },
        client,
        tx,
      )
    })
    return this.get(actor, publicId)
  }

  async dashboard(actor: Actor) {
    const db = this.conversations.client
    const scope = {
      property: {
        ownerships: { some: { ownerId: actor.userId, isCurrent: true } },
      },
    }
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3_600_000)

    const [
      newContacts,
      unhandled,
      overdueActions,
      pendingVisits,
      confirmedUpcoming,
      completedVisits,
      responded,
      total,
      withVisit,
    ] = await Promise.all([
      db.inquiry.count({
        where: { ...scope, createdAt: { gte: weekAgo } },
      }),
      db.inquiry.count({
        where: { ...scope, status: "OPEN", firstRespondedAt: null },
      }),
      db.inquiry.count({
        where: {
          ...scope,
          nextActionAt: { lte: now },
          stage: { notIn: ["LOST", "ARCHIVED", "CONVERTED"] },
        },
      }),
      db.appointment.count({
        where: {
          status: "PENDING",
          property: {
            ownerships: { some: { ownerId: actor.userId, isCurrent: true } },
          },
        },
      }),
      db.appointment.count({
        where: {
          status: "CONFIRMED",
          scheduledAt: { gte: now },
          property: {
            ownerships: { some: { ownerId: actor.userId, isCurrent: true } },
          },
        },
      }),
      db.appointment.count({
        where: {
          status: "COMPLETED",
          property: {
            ownerships: { some: { ownerId: actor.userId, isCurrent: true } },
          },
        },
      }),
      db.inquiry.count({
        where: { ...scope, firstRespondedAt: { not: null } },
      }),
      db.inquiry.count({ where: scope }),
      db.inquiry.count({
        where: {
          ...scope,
          appointments: {
            some: { status: { in: ["CONFIRMED", "COMPLETED"] } },
          },
        },
      }),
    ])

    const [responseSamples, listingCounts] = await Promise.all([
      db.inquiry.findMany({
        where: { ...scope, firstRespondedAt: { not: null } },
        select: { createdAt: true, firstRespondedAt: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
      db.inquiry.groupBy({
        by: ["listingId"],
        where: scope,
        _count: { _all: true },
        orderBy: { _count: { listingId: "desc" } },
        take: 5,
      }),
    ])
    const delays = responseSamples
      .map((row) =>
        row.firstRespondedAt
          ? row.firstRespondedAt.getTime() - row.createdAt.getTime()
          : null,
      )
      .filter((value): value is number => value !== null && value >= 0)
      .sort((a, b) => a - b)
    const medianMs =
      delays.length === 0 ? null : delays[Math.floor(delays.length / 2)]!

    const listingRows =
      listingCounts.length === 0
        ? []
        : await db.listing.findMany({
            where: { id: { in: listingCounts.map((row) => row.listingId) } },
            select: { id: true, publicId: true, title: true },
          })
    const listingById = new Map(listingRows.map((row) => [row.id, row]))
    const topListings = listingCounts.flatMap((row) => {
      const listing = listingById.get(row.listingId)
      if (!listing) return []
      return [
        {
          id: listing.publicId,
          title: listing.title,
          contacts: row._count._all,
        },
      ]
    })

    return {
      windowDays: 7,
      newContacts,
      unhandled,
      overdueActions,
      pendingVisits,
      confirmedUpcomingVisits: confirmedUpcoming,
      completedVisits,
      responseRate: total === 0 ? null : responded / total,
      medianFirstResponseHours:
        medianMs === null ? null : Math.round((medianMs / 3_600_000) * 10) / 10,
      contactToVisitRate: total === 0 ? null : withVisit / total,
      totals: { inquiries: total, responded },
      topListings,
      computedAt: now.toISOString(),
    }
  }

  /**
   * Première réponse côté annonce : horodate + passage NEW → CONTACTED.
   */
  async markFirstResponse(
    inquiryId: bigint,
    actorUserId: bigint,
    tx: Prisma.TransactionClient,
  ) {
    const row = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, stage: true, firstRespondedAt: true, publicId: true },
    })
    if (!row || row.firstRespondedAt) return
    const nextStage = suggestedStageAfterFirstReply(row.stage)
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: {
        firstRespondedAt: new Date(),
        status: "IN_PROGRESS",
        ...(nextStage ? { stage: nextStage } : {}),
      },
    })
    if (nextStage) {
      await tx.inquiryStageHistory.create({
        data: {
          inquiryId,
          fromStage: row.stage,
          toStage: nextStage,
          authorId: actorUserId,
          reason: "FIRST_RESPONSE",
        },
      })
    }
  }

  async applyVisitHint(
    inquiryId: bigint | null,
    actorUserId: bigint,
    event: "CONFIRMED" | "COMPLETED",
    tx: Prisma.TransactionClient,
  ) {
    if (!inquiryId) return
    const row = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, stage: true, publicId: true },
    })
    if (!row) return
    const next = suggestedStageAfterVisit(row.stage, event)
    if (!next) return
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { stage: next },
    })
    await tx.inquiryStageHistory.create({
      data: {
        inquiryId,
        fromStage: row.stage,
        toStage: next,
        authorId: actorUserId,
        reason: event,
      },
    })
  }

  private async requireManaged(
    userId: bigint,
    publicId: string,
    withDetail: boolean,
  ) {
    const row = await this.conversations.client.inquiry.findUnique({
      where: { publicId },
      select: { ...inquirySelect, propertyId: true, id: true },
    })
    if (!row) throw communicationError("INQUIRY_NOT_FOUND")
    const manager = await this.conversations.isCurrentManager(
      row.propertyId,
      userId,
    )
    if (!manager) throw communicationError("INQUIRY_NOT_FOUND")
    void withDetail
    return row
  }

  private toListView(row: InquiryRow, now: Date) {
    const listingPrice = row.listing.prices[0]
      ? BigInt(Math.round(Number(row.listing.prices[0].amount)))
      : null
    const hasPendingVisit = row.appointments.some(
      (item) =>
        item.status === "PENDING" || item.status === "RESCHEDULE_REQUESTED",
    )
    const hasConfirmedVisit = row.appointments.some(
      (item) => item.status === "CONFIRMED",
    )
    const ranking: InquiryPriorityResult = prioritizeInquiry({
      stage: row.stage,
      status: row.status,
      createdAt: row.createdAt,
      nextActionAt: row.nextActionAt,
      budgetAmount: row.budgetAmount,
      listingPrice,
      hasPendingVisit,
      hasConfirmedVisit,
      firstRespondedAt: row.firstRespondedAt,
      now,
    })
    return {
      id: row.publicId,
      type: row.type,
      status: row.status,
      stage: row.stage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastActivityAt: row.conversation?.lastActivityAt ?? row.updatedAt,
      nextAction: row.nextAction,
      nextActionAt: row.nextActionAt,
      budgetAmount: row.budgetAmount === null ? null : Number(row.budgetAmount),
      firstRespondedAt: row.firstRespondedAt,
      prospect: {
        id: row.user.publicId,
        displayName: displayName(row.user),
      },
      assignee: row.assignee
        ? { id: row.assignee.publicId, displayName: displayName(row.assignee) }
        : null,
      listing: {
        id: row.listing.publicId,
        title: row.listing.title,
        listingType: row.listing.listingType,
        status: row.listing.status,
        price: listingPrice === null ? null : Number(listingPrice),
        currency: row.listing.prices[0]?.currency ?? "XOF",
      },
      conversationId: row.conversation?.publicId ?? null,
      appointments: row.appointments.map((item) => ({
        id: item.publicId,
        status: item.status,
        scheduledAt: item.scheduledAt,
      })),
      priority: ranking.priority,
      priorityScore: ranking.score,
      priorityReasons: ranking.reasons,
      suggestedAction: ranking.suggestedAction,
    }
  }
}
