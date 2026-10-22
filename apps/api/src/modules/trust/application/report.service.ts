import { Injectable } from "@nestjs/common"
import { decodeCursor, encodeCursor } from "@mon-appart/validation"

import type { Tx } from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import type {
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  VerificationPriority,
} from "../../../generated/prisma/enums"
import {
  ConversationModerationService,
  NotificationService,
  type ModerationExcerptMessage,
} from "../../communication"
import type { Actor, ClientContext } from "../../identity"
import { ListingService } from "../../listing"
import {
  reportThresholdReached,
  RiskRule,
  RULE_SEVERITY,
} from "../domain/risk-rules"
import { trustError } from "../domain/trust-errors"
import {
  REPORT_ENTITY,
  TrustAuditAction,
  TrustEvent,
} from "../domain/trust-events"
import { reportNotice } from "../domain/trust-notifications"
import { TrustRepository } from "../infrastructure/trust.repository"
import { TrustConfig } from "../trust.config"
import { TrustActivity } from "./trust-activity"

export interface CreateReportInput {
  targetType: ReportTargetType
  listingId?: string
  userId?: string
  conversationId?: string
  messageId?: string
  reason: ReportReason
  description?: string
}

interface ResolvedTarget {
  listingId: bigint | null
  userId: bigint | null
  conversationId: bigint | null
  messageId: bigint | null
  publicId: string
  /** Compte visé pour l'alerte de seuil (auteur d'un message signalé). */
  signalUserId: bigint | null
}

export interface ResolveReportInput {
  outcome: "CONFIRMED" | "DISMISSED"
  action?: ReportAction
  internalNote?: string
}

/** Vue du déclarant : statut d'avancement seulement, jamais l'issue détaillée. */
export interface OwnReportView {
  id: string
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  status: "OPEN" | "IN_REVIEW" | "RESOLVED"
  createdAt: Date
  resolvedAt: Date | null
}

export interface ReviewReportView {
  id: string
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  description: string | null
  status: ReportStatus
  priority: VerificationPriority
  action: ReportAction | null
  reporterId: string | null
  assignedTo: string | null
  /** Déclarants distincts ayant un signalement ouvert sur la même cible. */
  openReportsOnTarget: number
  /**
   * Message ou conversation signalé : seul extrait visible du modérateur (le
   * message visé, ou les derniers messages), jamais la conversation entière.
   */
  conversationExcerpt?: ModerationExcerptMessage[]
  createdAt: Date
  resolvedAt: Date | null
  history: {
    action: string
    status: ReportStatus
    actorId: string | null
    internalNote: string | null
    at: Date
  }[]
}

const OPEN_REPORT_STATUSES: ReportStatus[] = ["OPEN", "IN_REVIEW"]
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reportSelect = {
  id: true,
  publicId: true,
  reporterId: true,
  targetType: true,
  listingId: true,
  targetUserId: true,
  reason: true,
  description: true,
  status: true,
  priority: true,
  action: true,
  assignedToId: true,
  resolvedAt: true,
  createdAt: true,
  reporter: { select: { publicId: true } },
  assignedTo: { select: { publicId: true } },
  listing: {
    select: {
      publicId: true,
      title: true,
      status: true,
      propertyId: true,
      createdById: true,
    },
  },
  targetUser: { select: { publicId: true } },
  conversationId: true,
  messageId: true,
  conversation: {
    select: { publicId: true, propertyId: true, requesterId: true },
  },
  message: { select: { publicId: true, authorId: true } },
} satisfies Prisma.ReportSelect

type ReportRow = Prisma.ReportGetPayload<{ select: typeof reportSelect }>

/**
 * Signalements : des allégations à examiner. Aucun signalement, ni aucun
 * cumul de signalements, ne suspend, ne rejette ni ne révoque quoi que ce
 * soit automatiquement : seul un modérateur décide, après examen.
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly listings: ListingService,
    private readonly notifications: NotificationService,
    private readonly conversations: ConversationModerationService,
    private readonly activity: TrustActivity,
    private readonly config: TrustConfig,
  ) {}

  async create(
    actor: Actor,
    input: CreateReportInput,
    client: ClientContext,
  ): Promise<OwnReportView> {
    const target = await this.resolveTarget(actor, input)
    const description = input.description?.trim().slice(0, 1000) || null

    const created = await this.trust.transaction(async (tx) => {
      await this.trust.lockUser(actor.userId, tx)
      const since = new Date(Date.now() - 86_400_000)
      const today = await tx.report.count({
        where: { reporterId: actor.userId, createdAt: { gte: since } },
      })
      if (today >= this.config.reportDailyLimit) {
        throw trustError("REPORT_LIMIT_REACHED")
      }
      const targetWhere = targetFilter(target)
      const existing = await tx.report.findFirst({
        where: {
          reporterId: actor.userId,
          status: { in: OPEN_REPORT_STATUSES },
          ...targetWhere,
        },
        select: { id: true },
      })
      if (existing) throw trustError("REPORT_ALREADY_OPEN")

      const report = await tx.report.create({
        data: {
          reporterId: actor.userId,
          targetType: input.targetType,
          listingId: target.listingId,
          targetUserId: target.userId,
          conversationId: target.conversationId,
          messageId: target.messageId,
          reason: input.reason,
          description,
        },
        select: { id: true, publicId: true, createdAt: true },
      })
      await tx.reportEvent.create({
        data: {
          reportId: report.id,
          action: "CREATED",
          toStatus: "OPEN",
          actorId: actor.userId,
          actorKind: "USER",
        },
      })

      const reporters = await tx.report.findMany({
        where: {
          status: { in: OPEN_REPORT_STATUSES },
          reporterId: { not: null },
          ...targetWhere,
        },
        distinct: ["reporterId"],
        select: { reporterId: true },
      })
      const threshold = reportThresholdReached(
        reporters.length,
        this.config.reportReviewThreshold,
      )
      if (threshold) {
        // Priorité d'examen seulement : la cible reste en ligne.
        await tx.report.updateMany({
          where: { status: { in: OPEN_REPORT_STATUSES }, ...targetWhere },
          data: { priority: "HIGH" },
        })
        await this.trust.raiseSignal(
          {
            ruleCode: RiskRule.REPORT_THRESHOLD,
            severity: RULE_SEVERITY.REPORT_THRESHOLD,
            dedupKey: `${RiskRule.REPORT_THRESHOLD}:${input.targetType}:${target.publicId}`,
            userId: target.userId ?? target.signalUserId,
            listingId: target.listingId,
            details: {
              targetType: input.targetType,
              targetId: target.publicId,
              distinctReporters: reporters.length,
            },
          },
          tx,
        )
      }

      await this.activity.audit(
        {
          action: TrustAuditAction.REPORT_CREATED,
          actorId: actor.userId,
          entityType: REPORT_ENTITY,
          entityId: report.publicId,
          // Le texte libre du déclarant reste dans le signalement, pas dans l'audit.
          newValues: {
            targetType: input.targetType,
            targetId: target.publicId,
            reason: input.reason,
          },
        },
        client,
        tx,
      )
      await this.notifications.notify(
        actor.userId,
        {
          type: "REPORT",
          ...reportNotice.received(),
          data: { reportId: report.publicId },
        },
        tx,
      )
      return { ...report, threshold }
    })

    this.activity.emit(TrustEvent.REPORT_CREATED, created.publicId, {
      reportId: created.publicId,
      targetType: input.targetType,
      targetId: target.publicId,
      reason: input.reason,
    })
    this.activity.log("trust.report_created", client, {
      report_id: created.publicId,
      target_type: input.targetType,
      reason: input.reason,
      threshold_reached: created.threshold,
    })
    return {
      id: created.publicId,
      targetType: input.targetType,
      targetId: target.publicId,
      reason: input.reason,
      status: "OPEN",
      createdAt: created.createdAt,
      resolvedAt: null,
    }
  }

  async listOwn(actor: Actor): Promise<OwnReportView[]> {
    const rows = await this.trust.client.report.findMany({
      where: { reporterId: actor.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: reportSelect,
    })
    return rows.map(ownView)
  }

  async getOwn(actor: Actor, publicId: string): Promise<OwnReportView> {
    const row = await this.trust.client.report.findUnique({
      where: { publicId },
      select: reportSelect,
    })
    if (!row || row.reporterId !== actor.userId) {
      throw trustError("REPORT_NOT_FOUND")
    }
    return ownView(row)
  }

  // ------------------------------------------------------------- modération

  async queue(filters: {
    status?: ReportStatus
    targetType?: ReportTargetType
    priority?: VerificationPriority
    cursor?: string
    limit?: number
  }): Promise<{ items: ReviewReportView[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100)
    let pivot: { id: bigint; createdAt: Date } | null = null
    if (filters.cursor) {
      const payload = decodeCursor(filters.cursor)
      if (!payload || !UUID_PATTERN.test(payload.id)) {
        throw trustError("INVALID_CURSOR")
      }
      pivot = await this.trust.client.report.findUnique({
        where: { publicId: payload.id },
        select: { id: true, createdAt: true },
      })
      if (!pivot) return { items: [], nextCursor: null }
    }
    const rows = await this.trust.client.report.findMany({
      where: {
        status: filters.status ?? { in: OPEN_REPORT_STATUSES },
        ...(filters.targetType ? { targetType: filters.targetType } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(pivot
          ? {
              OR: [
                { createdAt: { gt: pivot.createdAt } },
                { createdAt: pivot.createdAt, id: { gt: pivot.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: reportSelect,
    })
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      items: await Promise.all(page.map((row) => this.reviewView(row, false))),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              id: last.publicId,
              createdAt: last.createdAt.toISOString(),
            })
          : null,
    }
  }

  async detail(actor: Actor, publicId: string): Promise<ReviewReportView> {
    const row = await this.load(publicId)
    await this.assertIndependent(actor.userId, row)
    return this.reviewView(row, true)
  }

  async assign(
    actor: Actor,
    publicId: string,
    client: ClientContext,
  ): Promise<ReviewReportView> {
    await this.trust.transaction(async (tx) => {
      const row = await this.lock(publicId, tx)
      await this.assertIndependent(actor.userId, row, tx)
      if (!OPEN_REPORT_STATUSES.includes(row.status)) {
        throw trustError("INVALID_REPORT_TRANSITION")
      }
      await tx.report.update({
        where: { id: row.id },
        data: { status: "IN_REVIEW", assignedToId: actor.userId },
      })
      await tx.reportEvent.create({
        data: {
          reportId: row.id,
          action: "ASSIGNED",
          fromStatus: row.status,
          toStatus: "IN_REVIEW",
          actorId: actor.userId,
          actorKind: "REVIEWER",
        },
      })
      await this.activity.audit(
        {
          action: TrustAuditAction.REPORT_ASSIGNED,
          actorId: actor.userId,
          entityType: REPORT_ENTITY,
          entityId: row.publicId,
          oldValues: { status: row.status },
          newValues: { status: "IN_REVIEW" },
        },
        client,
        tx,
      )
    })
    return this.detail(actor, publicId)
  }

  /**
   * Issue d'un examen. Une suspension passe par le workflow Listing (droits,
   * historique, audit propres) avant la clôture du signalement ; une demande
   * de réexamen ouvre une alerte pour les agents de confiance, sans révoquer.
   */
  async resolve(
    actor: Actor,
    publicId: string,
    input: ResolveReportInput,
    client: ClientContext,
  ): Promise<ReviewReportView> {
    const action = input.action ?? "NONE"
    const current = await this.load(publicId)
    await this.assertIndependent(actor.userId, current)
    if (!OPEN_REPORT_STATUSES.includes(current.status)) {
      throw trustError("INVALID_REPORT_TRANSITION")
    }
    if (action !== "NONE" && input.outcome !== "CONFIRMED") {
      throw trustError("INVALID_REPORT_TRANSITION", "action sans confirmation")
    }
    if (action === "LISTING_SUSPENDED") {
      if (!current.listing) {
        throw trustError("INVALID_REPORT_TRANSITION", "cible sans annonce")
      }
    }
    if (action === "CONVERSATION_CLOSED" && current.conversationId === null) {
      throw trustError("INVALID_REPORT_TRANSITION", "cible sans conversation")
    }
    if (
      action === "LISTING_SUSPENDED" &&
      current.listing &&
      current.listing.status !== "SUSPENDED"
    ) {
      await this.listings.changeStatus(
        actor,
        current.listing.publicId,
        { status: "SUSPENDED", reason: `report:${current.publicId}` },
        client,
      )
    }

    let afterCommit: (() => Promise<void>) | null = null
    const resolved = await this.trust.transaction(async (tx) => {
      const row = await this.lock(publicId, tx)
      if (!OPEN_REPORT_STATUSES.includes(row.status)) {
        throw trustError("INVALID_REPORT_TRANSITION")
      }
      if (action === "CONVERSATION_CLOSED" && row.conversationId !== null) {
        afterCommit = await this.conversations.close(
          tx,
          row.conversationId,
          actor.userId,
          row.publicId,
        )
      }
      const now = new Date()
      await tx.report.update({
        where: { id: row.id },
        data: {
          status: input.outcome,
          action,
          resolvedAt: now,
          resolvedById: actor.userId,
          resolutionNote: clean(input.internalNote),
        },
      })
      await tx.reportEvent.create({
        data: {
          reportId: row.id,
          action: action === "NONE" ? input.outcome : action,
          fromStatus: row.status,
          toStatus: input.outcome,
          actorId: actor.userId,
          actorKind: "REVIEWER",
          internalNote: clean(input.internalNote),
        },
      })
      if (action === "VERIFICATION_REVIEW_REQUESTED") {
        await this.trust.raiseSignal(
          {
            ruleCode: RiskRule.REPORT_REVIEW_REQUESTED,
            severity: RULE_SEVERITY.REPORT_REVIEW_REQUESTED,
            dedupKey: `${RiskRule.REPORT_REVIEW_REQUESTED}:${row.publicId}`,
            userId:
              row.targetUserId ??
              row.listing?.createdById ??
              row.message?.authorId ??
              null,
            listingId: row.listingId,
            details: { reportId: row.publicId, reason: row.reason },
          },
          tx,
        )
      }
      await this.activity.audit(
        {
          action: TrustAuditAction.REPORT_RESOLVED,
          actorId: actor.userId,
          entityType: REPORT_ENTITY,
          entityId: row.publicId,
          oldValues: { status: row.status },
          newValues: { status: input.outcome, action },
        },
        client,
        tx,
      )
      if (row.reporterId !== null) {
        await this.notifications.notify(
          row.reporterId,
          {
            type: "REPORT",
            ...reportNotice.processed(),
            data: { reportId: row.publicId },
          },
          tx,
        )
      }
      if (action === "LISTING_SUSPENDED" && row.listing) {
        await this.notifications.notify(
          row.listing.createdById,
          {
            type: "SYSTEM",
            ...reportNotice.listingSuspended(row.listing.title),
            data: { listingId: row.listing.publicId },
          },
          tx,
        )
      }
      return row
    })
    await (afterCommit as (() => Promise<void>) | null)?.()

    this.activity.emit(TrustEvent.REPORT_RESOLVED, resolved.publicId, {
      reportId: resolved.publicId,
      outcome: input.outcome,
      action,
    })
    const subject = resolved.targetUserId ? resolved.targetUser?.publicId : null
    if (input.outcome === "CONFIRMED") {
      const userId =
        subject ??
        (resolved.listing
          ? (await this.trust.findUserById(resolved.listing.createdById))
              ?.publicId
          : null)
      if (userId) {
        this.activity.emit(TrustEvent.TRUST_CHANGED, userId, {
          userId,
          propertyId: null,
          listingId: resolved.listing?.publicId ?? null,
        })
      }
    }
    this.activity.log("trust.report_resolved", client, {
      report_id: resolved.publicId,
      outcome: input.outcome,
      action,
    })
    return this.detail(actor, publicId)
  }

  // -------------------------------------------------------------------------

  /**
   * Cible visible et étrangère au déclarant : on ne signale ni soi-même, ni
   * une annonce dont on gère le bien, ni un brouillon (invisible au public).
   */
  private async resolveTarget(
    actor: Actor,
    input: CreateReportInput,
  ): Promise<ResolvedTarget> {
    const none = {
      listingId: null,
      userId: null,
      conversationId: null,
      messageId: null,
      signalUserId: null,
    }
    if (
      input.targetType === "MESSAGE" ||
      input.targetType === "CONVERSATION"
    ) {
      const forMessage = input.targetType === "MESSAGE"
      if (
        !input.conversationId ||
        forMessage !== Boolean(input.messageId) ||
        input.listingId ||
        input.userId
      ) {
        throw trustError("REPORT_NOT_FOUND", "cible incohérente")
      }
      // Réservé aux participants : un tiers reçoit 404 (CONVERSATION_NOT_FOUND).
      const target = await this.conversations.resolveReportTarget(
        actor.userId,
        input.conversationId,
        input.messageId ?? null,
      )
      return {
        ...none,
        conversationId: target.conversationId,
        messageId: target.messageId,
        publicId: target.messagePublicId ?? target.conversationPublicId,
        signalUserId: forMessage ? (target.reportedUserIds[0] ?? null) : null,
      }
    }
    if (input.conversationId || input.messageId) {
      throw trustError("REPORT_NOT_FOUND", "cible incohérente")
    }
    if (input.targetType === "LISTING") {
      if (!input.listingId || input.userId) {
        throw trustError("REPORT_NOT_FOUND", "cible incohérente")
      }
      const listing = await this.trust.client.listing.findFirst({
        where: {
          publicId: input.listingId,
          deletedAt: null,
          status: { notIn: ["DRAFT", "PENDING_REVIEW"] },
        },
        select: {
          id: true,
          publicId: true,
          propertyId: true,
          createdById: true,
        },
      })
      if (!listing) throw trustError("LISTING_NOT_FOUND")
      const relations = await this.trust.currentRelations(listing.propertyId)
      if (listing.createdById === actor.userId || relations.has(actor.userId)) {
        throw trustError("REPORT_SELF_FORBIDDEN")
      }
      return { ...none, listingId: listing.id, publicId: listing.publicId }
    }
    if (!input.userId || input.listingId) {
      throw trustError("REPORT_NOT_FOUND", "cible incohérente")
    }
    const user = await this.trust.findUserByPublicId(input.userId)
    if (!user) throw trustError("USER_NOT_FOUND")
    if (user.id === actor.userId) throw trustError("REPORT_SELF_FORBIDDEN")
    return { ...none, userId: user.id, publicId: user.publicId }
  }

  private async load(publicId: string): Promise<ReportRow> {
    const row = await this.trust.client.report.findUnique({
      where: { publicId },
      select: reportSelect,
    })
    if (!row) throw trustError("REPORT_NOT_FOUND")
    return row
  }

  private async lock(publicId: string, tx: Tx): Promise<ReportRow> {
    const rows = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM reports WHERE public_id = ${publicId}::uuid FOR UPDATE
    `
    const row = rows[0]
      ? await tx.report.findUnique({
          where: { id: rows[0].id },
          select: reportSelect,
        })
      : null
    if (!row) throw trustError("REPORT_NOT_FOUND")
    return row
  }

  /** Ni déclarant, ni cible, ni gestionnaire du bien de l'annonce visée. */
  private async assertIndependent(
    reviewerId: bigint,
    row: ReportRow,
    tx?: Tx,
  ): Promise<void> {
    if (row.reporterId === reviewerId || row.targetUserId === reviewerId) {
      throw trustError("CONFLICT_OF_INTEREST")
    }
    if (row.listing) {
      if (row.listing.createdById === reviewerId) {
        throw trustError("CONFLICT_OF_INTEREST")
      }
      const relations = await this.trust.currentRelations(
        row.listing.propertyId,
        tx,
      )
      if (relations.has(reviewerId)) throw trustError("CONFLICT_OF_INTEREST")
    }
    if (row.conversation) {
      // Ni participant de la conversation, ni auteur du message signalé.
      if (
        row.conversation.requesterId === reviewerId ||
        row.message?.authorId === reviewerId
      ) {
        throw trustError("CONFLICT_OF_INTEREST")
      }
      const relations = await this.trust.currentRelations(
        row.conversation.propertyId,
        tx,
      )
      if (relations.has(reviewerId)) throw trustError("CONFLICT_OF_INTEREST")
    }
  }

  private async reviewView(
    row: ReportRow,
    withHistory: boolean,
  ): Promise<ReviewReportView> {
    const targetWhere = targetFilter({
      listingId: row.listingId,
      userId: row.targetUserId,
      conversationId: row.conversationId,
      messageId: row.messageId,
    })
    const [reporters, events, excerpt] = await Promise.all([
      this.trust.client.report.findMany({
        where: {
          status: { in: OPEN_REPORT_STATUSES },
          reporterId: { not: null },
          ...targetWhere,
        },
        distinct: ["reporterId"],
        select: { reporterId: true },
      }),
      withHistory
        ? this.trust.client.reportEvent.findMany({
            where: { reportId: row.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              action: true,
              toStatus: true,
              internalNote: true,
              createdAt: true,
              actor: { select: { publicId: true } },
            },
          })
        : Promise.resolve([]),
      withHistory && row.conversationId !== null
        ? this.conversations.excerpt(row.conversationId, row.messageId)
        : Promise.resolve(undefined),
    ])
    return {
      id: row.publicId,
      targetType: row.targetType,
      targetId: targetPublicId(row),
      reason: row.reason,
      description: row.description,
      status: row.status,
      priority: row.priority,
      action: row.action,
      reporterId: row.reporter?.publicId ?? null,
      assignedTo: row.assignedTo?.publicId ?? null,
      openReportsOnTarget: reporters.length,
      ...(excerpt ? { conversationExcerpt: excerpt } : {}),
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      history: events.map((event) => ({
        action: event.action,
        status: event.toStatus,
        actorId: event.actor?.publicId ?? null,
        internalNote: event.internalNote,
        at: event.createdAt,
      })),
    }
  }
}

function targetPublicId(row: ReportRow): string {
  return (
    row.listing?.publicId ??
    row.targetUser?.publicId ??
    row.message?.publicId ??
    row.conversation?.publicId ??
    ""
  )
}

/** Signalements portant sur la même cible (un message n'est pas sa conversation). */
function targetFilter(target: {
  listingId: bigint | null
  userId: bigint | null
  conversationId: bigint | null
  messageId: bigint | null
}): Prisma.ReportWhereInput {
  if (target.listingId !== null) return { listingId: target.listingId }
  if (target.userId !== null) return { targetUserId: target.userId }
  if (target.messageId !== null) return { messageId: target.messageId }
  return { conversationId: target.conversationId, messageId: null }
}

function ownView(row: ReportRow): OwnReportView {
  return {
    id: row.publicId,
    targetType: row.targetType,
    targetId: targetPublicId(row),
    reason: row.reason,
    status:
      row.status === "CONFIRMED" || row.status === "DISMISSED"
        ? "RESOLVED"
        : row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}

function clean(value: string | undefined | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 2000) : null
}
