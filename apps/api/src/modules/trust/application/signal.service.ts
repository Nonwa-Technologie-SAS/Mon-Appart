import { Injectable } from "@nestjs/common"
import { decodeCursor, encodeCursor } from "@mon-appart/validation"

import type { DomainEvent } from "../../../common/events/domain-event"
import { OnEvents } from "../../../common/events/on-events.decorator"
import type {
  TrustSignalSeverity,
  TrustSignalStatus,
} from "../../../generated/prisma/enums"
import { CommunicationEvent } from "../../communication"
import { can, type Actor, type ClientContext } from "../../identity"
import { ListingEvent } from "../../listing"
import { isMaterialListingChange } from "../domain/listing-risk"
import {
  isListingBurst,
  isPriceChangeAnomaly,
  RiskRule,
  RULE_SEVERITY,
} from "../domain/risk-rules"
import { trustError } from "../domain/trust-errors"
import {
  TRUST_SIGNAL_ENTITY,
  TrustAuditAction,
  TrustEvent,
} from "../domain/trust-events"
import { TrustRepository } from "../infrastructure/trust.repository"
import { TrustConfig } from "../trust.config"
import { TrustActivity } from "./trust-activity"

export interface SignalView {
  id: string
  ruleCode: string
  severity: TrustSignalSeverity
  status: TrustSignalStatus
  userId: string | null
  listingId: string | null
  verificationId: string | null
  /** Faits observés (compteurs, identifiants publics) ; jamais une conclusion. */
  details: Record<string, unknown>
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNote: string | null
  createdAt: Date
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const signalSelect = {
  id: true,
  publicId: true,
  ruleCode: true,
  severity: true,
  status: true,
  details: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  user: { select: { publicId: true } },
  listing: { select: { publicId: true } },
  verification: { select: { publicId: true } },
  reviewedBy: { select: { publicId: true } },
} as const

interface PriceChangedPayload {
  listingId: string
  oldAmount: string | null
  newAmount: string
}

interface ListingCreatedPayload {
  listingId: string
  propertyId: string
  listingType: string
}

interface ListingUpdatedPayload {
  listingId: string
  changedFields?: string[]
}

interface MessageSafetyPayload {
  conversationId?: string
  messageId?: string
  rule?: string
}

/**
 * Alertes des règles de risque : à examiner par un humain. Les confirmer ou
 * les écarter n'a aucun effet automatique sur un compte, une annonce ou une
 * vérification ; les mesures passent par les workflows dédiés.
 */
@Injectable()
export class SignalService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly activity: TrustActivity,
    private readonly config: TrustConfig,
  ) {}

  async list(
    actor: Actor,
    filters: {
      status?: TrustSignalStatus
      severity?: TrustSignalSeverity
      cursor?: string
      limit?: number
    },
  ): Promise<{ items: SignalView[]; nextCursor: string | null }> {
    assertSignalReviewer(actor)
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100)
    let pivot: { id: bigint; createdAt: Date } | null = null
    if (filters.cursor) {
      const payload = decodeCursor(filters.cursor)
      if (!payload || !UUID_PATTERN.test(payload.id)) {
        throw trustError("INVALID_CURSOR")
      }
      pivot = await this.trust.client.trustSignal.findUnique({
        where: { publicId: payload.id },
        select: { id: true, createdAt: true },
      })
      if (!pivot) return { items: [], nextCursor: null }
    }
    const rows = await this.trust.client.trustSignal.findMany({
      where: {
        status: filters.status ?? "OPEN",
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(pivot
          ? {
              OR: [
                { createdAt: { lt: pivot.createdAt } },
                { createdAt: pivot.createdAt, id: { lt: pivot.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: signalSelect,
    })
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      items: page.map(toView),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              id: last.publicId,
              createdAt: last.createdAt.toISOString(),
            })
          : null,
    }
  }

  async review(
    actor: Actor,
    publicId: string,
    input: { outcome: "CONFIRMED" | "DISMISSED"; note?: string },
    client: ClientContext,
  ): Promise<SignalView> {
    assertSignalReviewer(actor)
    const row = await this.trust.transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM trust_signals WHERE public_id = ${publicId}::uuid FOR UPDATE
      `
      const current = rows[0]
        ? await tx.trustSignal.findUnique({
            where: { id: rows[0].id },
            select: { ...signalSelect, userId: true },
          })
        : null
      if (!current) throw trustError("SIGNAL_NOT_FOUND")
      if (current.status !== "OPEN") throw trustError("SIGNAL_ALREADY_REVIEWED")
      if (current.userId === actor.userId) {
        throw trustError("CONFLICT_OF_INTEREST")
      }
      const updated = await tx.trustSignal.update({
        where: { id: current.id },
        data: {
          status: input.outcome,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          reviewNote: input.note?.trim().slice(0, 2000) || null,
        },
        select: signalSelect,
      })
      await this.activity.audit(
        {
          action: TrustAuditAction.SIGNAL_REVIEWED,
          actorId: actor.userId,
          entityType: TRUST_SIGNAL_ENTITY,
          entityId: updated.publicId,
          oldValues: { status: "OPEN" },
          newValues: { status: input.outcome, ruleCode: updated.ruleCode },
        },
        client,
        tx,
      )
      return updated
    })
    this.activity.emit(TrustEvent.SIGNAL_REVIEWED, row.publicId, {
      signalId: row.publicId,
      ruleCode: row.ruleCode,
      outcome: input.outcome,
    })
    return toView(row)
  }

  /** Variation de prix forte sur une annonce en ligne : alerte, rien de plus. */
  @OnEvents([ListingEvent.PRICE_CHANGED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onPriceChanged(event: DomainEvent<PriceChangedPayload>): Promise<void> {
    const { oldAmount, newAmount } = event.payload
    if (oldAmount === null) return
    if (
      !isPriceChangeAnomaly(
        Number(oldAmount),
        Number(newAmount),
        this.config.priceChangeAlertRatio,
      )
    ) {
      return
    }
    const listing = await this.trust.client.listing.findFirst({
      where: {
        publicId: event.payload.listingId,
        deletedAt: null,
        status: { in: ["PUBLISHED", "PAUSED"] },
      },
      select: { id: true, publicId: true, createdById: true },
    })
    if (!listing) return
    const id = await this.trust.raiseSignal(
      {
        ruleCode: RiskRule.PRICE_CHANGE_ANOMALY,
        severity: RULE_SEVERITY.PRICE_CHANGE_ANOMALY,
        dedupKey: `${RiskRule.PRICE_CHANGE_ANOMALY}:${listing.publicId}`,
        userId: listing.createdById,
        listingId: listing.id,
        details: {
          listingId: listing.publicId,
          oldAmount: Number(oldAmount),
          newAmount: Number(newAmount),
        },
      },
      this.trust.client,
    )
    if (id) {
      this.activity.emit(TrustEvent.SIGNAL_RAISED, id, {
        signalId: id,
        ruleCode: RiskRule.PRICE_CHANGE_ANOMALY,
      })
    }
  }

  /**
   * Pic de création d'annonces : signal de revue humaine.
   * Ne suspend ni ne bloque le compte automatiquement.
   */
  @OnEvents([ListingEvent.CREATED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onListingCreated(
    event: DomainEvent<ListingCreatedPayload>,
  ): Promise<void> {
    const listing = await this.trust.client.listing.findFirst({
      where: { publicId: event.payload.listingId, deletedAt: null },
      select: { id: true, publicId: true, createdById: true },
    })
    if (!listing?.createdById) return

    const since = new Date(
      Date.now() - this.config.listingBurstWindowHours * 3_600_000,
    )
    const createdInWindow = await this.trust.client.listing.count({
      where: {
        createdById: listing.createdById,
        deletedAt: null,
        createdAt: { gte: since },
      },
    })
    if (isListingBurst(createdInWindow, this.config.listingBurstThreshold)) {
      const dayKey = since.toISOString().slice(0, 10)
      const id = await this.trust.raiseSignal(
        {
          ruleCode: RiskRule.ACCOUNT_BURST_ACTIVITY,
          severity: RULE_SEVERITY.ACCOUNT_BURST_ACTIVITY,
          dedupKey: `${RiskRule.ACCOUNT_BURST_ACTIVITY}:${listing.createdById}:${dayKey}`,
          userId: listing.createdById,
          listingId: listing.id,
          details: {
            listingId: listing.publicId,
            createdInWindow,
            threshold: this.config.listingBurstThreshold,
            windowHours: this.config.listingBurstWindowHours,
          },
        },
        this.trust.client,
      )
      if (id) {
        this.activity.emit(TrustEvent.SIGNAL_RAISED, id, {
          signalId: id,
          ruleCode: RiskRule.ACCOUNT_BURST_ACTIVITY,
        })
      }
    }
    await this.raiseDuplicateListing(
      listing.id,
      listing.publicId,
      listing.createdById,
    )
    await this.raiseReusedMedia(
      listing.id,
      listing.publicId,
      listing.createdById,
    )
  }

  @OnEvents([ListingEvent.PUBLISHED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onListingPublished(
    event: DomainEvent<{ listingId?: string }>,
  ): Promise<void> {
    const publicId = event.payload.listingId ?? event.aggregateId
    const listing = await this.trust.client.listing.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, publicId: true, createdById: true },
    })
    if (!listing) return
    await this.raiseDuplicateListing(
      listing.id,
      listing.publicId,
      listing.createdById,
    )
    await this.raiseReusedMedia(
      listing.id,
      listing.publicId,
      listing.createdById,
    )
  }

  @OnEvents([ListingEvent.UPDATED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onListingUpdated(
    event: DomainEvent<ListingUpdatedPayload>,
  ): Promise<void> {
    const fields = event.payload.changedFields ?? []
    if (!isMaterialListingChange(fields)) return
    const listing = await this.trust.client.listing.findFirst({
      where: { publicId: event.payload.listingId, deletedAt: null },
      select: { id: true, publicId: true, createdById: true },
    })
    if (!listing) return
    const verified = await this.trust.client.verification.findFirst({
      where: {
        listingId: listing.id,
        type: "LISTING_CONSISTENCY",
        status: "VERIFIED",
      },
      select: { id: true },
    })
    if (!verified) return
    const id = await this.trust.raiseSignal(
      {
        ruleCode: RiskRule.MATERIAL_CHANGE_AFTER_VERIFICATION,
        severity: RULE_SEVERITY.MATERIAL_CHANGE_AFTER_VERIFICATION,
        dedupKey: `${RiskRule.MATERIAL_CHANGE_AFTER_VERIFICATION}:${listing.publicId}`,
        userId: listing.createdById,
        listingId: listing.id,
        verificationId: verified.id,
        details: {
          listingId: listing.publicId,
          fields: fields.filter((field) =>
            [
              "title",
              "description",
              "listingType",
              "photos",
              "location",
              "contact",
            ].includes(field),
          ).length,
        },
      },
      this.trust.client,
    )
    if (id) {
      this.activity.emit(TrustEvent.SIGNAL_RAISED, id, {
        signalId: id,
        ruleCode: RiskRule.MATERIAL_CHANGE_AFTER_VERIFICATION,
      })
    }
  }

  @OnEvents([CommunicationEvent.MESSAGE_SAFETY_ALERT], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onMessageSafety(
    event: DomainEvent<MessageSafetyPayload>,
  ): Promise<void> {
    const rule = event.payload.rule
    if (
      rule !== RiskRule.MESSAGE_CREDENTIAL_HARVEST &&
      rule !== RiskRule.MESSAGE_FAKE_SUPPORT
    ) {
      return
    }
    const conversationId = event.payload.conversationId
    if (!conversationId || !UUID_PATTERN.test(conversationId)) return
    const conversation = await this.trust.client.conversation.findFirst({
      where: { publicId: conversationId },
      select: {
        id: true,
        publicId: true,
        listingId: true,
        listing: { select: { publicId: true, createdById: true } },
      },
    })
    if (!conversation) return
    const id = await this.trust.raiseSignal(
      {
        ruleCode: rule,
        severity: RULE_SEVERITY[rule],
        dedupKey: `${rule}:${conversation.publicId}`,
        userId: conversation.listing.createdById,
        listingId: conversation.listingId,
        details: {
          conversationId: conversation.publicId,
          listingId: conversation.listing.publicId,
        },
      },
      this.trust.client,
    )
    if (id) {
      this.activity.emit(TrustEvent.SIGNAL_RAISED, id, {
        signalId: id,
        ruleCode: rule,
      })
    }
  }

  private async raiseDuplicateListing(
    listingId: bigint,
    listingPublicId: string,
    createdById: bigint | null,
  ): Promise<void> {
    const listing = await this.trust.client.listing.findUnique({
      where: { id: listingId },
      select: { propertyId: true, listingType: true, status: true },
    })
    if (!listing || listing.status !== "PUBLISHED") return
    const others = await this.trust.client.listing.count({
      where: {
        propertyId: listing.propertyId,
        listingType: listing.listingType,
        status: "PUBLISHED",
        deletedAt: null,
        id: { not: listingId },
      },
    })
    if (others < 1) return
    const id = await this.trust.raiseSignal(
      {
        ruleCode: RiskRule.DUPLICATE_LISTING_SAME_PROPERTY,
        severity: RULE_SEVERITY.DUPLICATE_LISTING_SAME_PROPERTY,
        dedupKey: `${RiskRule.DUPLICATE_LISTING_SAME_PROPERTY}:${listing.propertyId}:${listing.listingType}`,
        userId: createdById,
        listingId,
        details: {
          listingId: listingPublicId,
          otherPublished: others,
        },
      },
      this.trust.client,
    )
    if (id) {
      this.activity.emit(TrustEvent.SIGNAL_RAISED, id, {
        signalId: id,
        ruleCode: RiskRule.DUPLICATE_LISTING_SAME_PROPERTY,
      })
    }
  }

  private async raiseReusedMedia(
    listingId: bigint,
    listingPublicId: string,
    createdById: bigint | null,
  ): Promise<void> {
    const listing = await this.trust.client.listing.findUnique({
      where: { id: listingId },
      select: { propertyId: true },
    })
    if (!listing) return
    const hashes = (
      await this.trust.client.media.findMany({
        where: {
          propertyId: listing.propertyId,
          purpose: "PROPERTY",
          contentSha256: { not: null },
        },
        select: { contentSha256: true },
        take: 40,
      })
    )
      .map((row) => row.contentSha256)
      .filter((value): value is string => Boolean(value))
    if (hashes.length === 0) return
    const otherAccounts = await this.trust.client.media.findMany({
      where: {
        purpose: "PROPERTY",
        contentSha256: { in: hashes },
        propertyId: { not: listing.propertyId },
        ...(createdById ? { uploadedById: { not: createdById } } : {}),
      },
      distinct: ["uploadedById"],
      select: { uploadedById: true },
      take: 5,
    })
    const count = otherAccounts.filter(
      (row) => row.uploadedById !== null,
    ).length
    if (count < 1) return
    const id = await this.trust.raiseSignal(
      {
        ruleCode: RiskRule.DUPLICATE_MEDIA_CROSS_ACCOUNT,
        severity: RULE_SEVERITY.DUPLICATE_MEDIA_CROSS_ACCOUNT,
        dedupKey: `${RiskRule.DUPLICATE_MEDIA_CROSS_ACCOUNT}:${listingPublicId}`,
        userId: createdById,
        listingId,
        details: {
          listingId: listingPublicId,
          otherAccounts: count,
        },
      },
      this.trust.client,
    )
    if (id) {
      this.activity.emit(TrustEvent.SIGNAL_RAISED, id, {
        signalId: id,
        ruleCode: RiskRule.DUPLICATE_MEDIA_CROSS_ACCOUNT,
      })
    }
  }
}

/** Modérateurs (signalements) et agents de confiance (vérifications). */
function assertSignalReviewer(actor: Actor): void {
  if (!can(actor, "verification:review") && !can(actor, "report:review")) {
    throw trustError(
      "DECISION_PERMISSION_REQUIRED",
      "verification:review ou report:review",
    )
  }
}

function toView(row: {
  publicId: string
  ruleCode: string
  severity: TrustSignalSeverity
  status: TrustSignalStatus
  details: unknown
  reviewedAt: Date | null
  reviewNote: string | null
  createdAt: Date
  user: { publicId: string } | null
  listing: { publicId: string } | null
  verification: { publicId: string } | null
  reviewedBy: { publicId: string } | null
}): SignalView {
  return {
    id: row.publicId,
    ruleCode: row.ruleCode,
    severity: row.severity,
    status: row.status,
    userId: row.user?.publicId ?? null,
    listingId: row.listing?.publicId ?? null,
    verificationId: row.verification?.publicId ?? null,
    details:
      row.details &&
      typeof row.details === "object" &&
      !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {},
    reviewedBy: row.reviewedBy?.publicId ?? null,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
  }
}
