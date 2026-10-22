import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { DatabaseService } from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import type {
  ListingStatus,
  ListingType,
} from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import { authError, AuthErrorCode, can, type Actor } from "../../identity"
import { ListingService } from "../../listing"
import { PUBLIC_MEDIA } from "../../property"
import { hasValidIdentity } from "../../trust/publication"
import { adminError } from "../domain/admin-errors"
import {
  availableDecisions,
  consistencyChecks,
  historyReason,
  MODERATION_RULES,
  moderationNotice,
  type ConsistencyCheck,
  type ModerationDecision,
} from "../domain/moderation"
import { AdminActivity, AdminAuditAction } from "./admin-activity"
import {
  AdminNoteService,
  displayName,
  type AdminNoteView,
} from "./admin-note.service"
import {
  ModerationReasonService,
  type ModerationReasonView,
} from "./moderation-reason.service"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OPEN_REPORTS = {
  status: { in: ["OPEN", "IN_REVIEW"] },
} satisfies Prisma.ReportWhereInput

export interface ListingQueueQuery {
  status?: ListingStatus
  listingType?: ListingType
  q?: string
  cursor?: string
  limit?: number
}

export interface ModerationInput {
  expectedStatus: ListingStatus
  reasonCode?: string
  ownerMessage?: string
  internalNote?: string
}

const CURRENT_PRICE = {
  where: { validTo: null },
  select: { amount: true, currency: true, period: true },
} as const

const queueSelect = {
  id: true,
  publicId: true,
  title: true,
  status: true,
  listingType: true,
  createdAt: true,
  updatedAt: true,
  prices: CURRENT_PRICE,
  property: {
    select: {
      publicId: true,
      propertyType: { select: { code: true, name: true } },
      neighborhood: {
        select: { name: true, commune: { select: { name: true } } },
      },
    },
  },
  createdBy: { select: { publicId: true, firstName: true, lastName: true } },
  _count: { select: { reports: { where: OPEN_REPORTS } } },
} satisfies Prisma.ListingSelect

type QueueRow = Prisma.ListingGetPayload<{ select: typeof queueSelect }>

/**
 * File de modération et décisions. Les transitions passent toutes par
 * `ListingService.changeStatus` (machine à états, verrou, historique, audit) ;
 * note interne, audit de la décision et notification du propriétaire sont
 * écrits dans la même transaction.
 */
@Injectable()
export class AdminListingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly listings: ListingService,
    private readonly reasons: ModerationReasonService,
    private readonly notes: AdminNoteService,
    private readonly notifications: NotificationService,
    private readonly activity: AdminActivity,
  ) {}

  async queue(actor: Actor, query: ListingQueueQuery) {
    assertModerator(actor)
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50)
    if (query.cursor && !UUID.test(query.cursor)) {
      throw adminError("ADMIN_CURSOR_INVALID")
    }
    const q = query.q?.trim()
    if (q !== undefined && q.length > 100) {
      throw adminError("ADMIN_QUERY_INVALID", "100 caractères au plus")
    }
    const status = query.status ?? "PENDING_REVIEW"
    const rows = await this.db.client.listing.findMany({
      where: {
        deletedAt: null,
        status,
        ...(query.listingType ? { listingType: query.listingType } : {}),
        ...(q
          ? UUID.test(q)
            ? { publicId: q.toLowerCase() }
            : { title: { contains: q, mode: "insensitive" } }
          : {}),
      },
      // Plus anciens d'abord : la file se vide par l'avant.
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: queueSelect,
    })
    const page = rows.slice(0, limit)
    return {
      status,
      items: page.map(toQueueItem),
      nextCursor: rows.length > limit ? page[page.length - 1]!.publicId : null,
    }
  }

  async detail(actor: Actor, publicId: string) {
    assertModerator(actor)
    const listing = await this.db.client.listing.findUnique({
      where: { publicId },
      select: {
        ...queueSelect,
        description: true,
        publishedAt: true,
        expiresAt: true,
        deletedAt: true,
        createdById: true,
        property: {
          select: {
            id: true,
            publicId: true,
            title: true,
            status: true,
            deletedAt: true,
            surface: true,
            landSurface: true,
            bedrooms: true,
            bathrooms: true,
            neighborhoodId: true,
            propertyTypeId: true,
            propertyType: { select: { code: true, name: true } },
            neighborhood: {
              select: { name: true, commune: { select: { name: true } } },
            },
            _count: { select: { media: { where: PUBLIC_MEDIA } } },
          },
        },
        statusHistory: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            oldStatus: true,
            newStatus: true,
            reason: true,
            createdAt: true,
            changedBy: { select: { publicId: true } },
          },
        },
        reports: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            publicId: true,
            reason: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })
    if (!listing || listing.deletedAt) throw adminError("LISTING_NOT_FOUND")

    const now = new Date()
    const price = listing.prices[0] ?? null
    const area = numberOrNull(
      listing.property.surface ?? listing.property.landSurface,
    )
    const [openSignals, identityVerified, comparables, notes, reasons] =
      await Promise.all([
        this.db.client.trustSignal.count({
          where: { listingId: listing.id, status: "OPEN" },
        }),
        hasValidIdentity(this.db.client, listing.createdById, now),
        price && area
          ? this.comparablePricePerSqm(listing, price)
          : Promise.resolve(null),
        this.notes.list("listing", listing.publicId),
        this.reasons.list({}),
      ])
    const checks: ConsistencyCheck[] = consistencyChecks({
      hasCurrentPrice: price !== null,
      photoCount: listing.property._count.media,
      descriptionLength: listing.description?.trim().length ?? 0,
      propertyActive:
        listing.property.status === "ACTIVE" &&
        listing.property.deletedAt === null,
      openReports: listing._count.reports,
      openSignals,
      publisherIdentityVerified: identityVerified,
      pricePerSqm: price && area ? Number(price.amount) / area : null,
      comparablePricePerSqm: comparables,
    })
    const decisions = availableDecisions(actor, listing.status).filter(() =>
      isNotOwnListing(actor, listing.createdById),
    )

    return {
      ...toQueueItem(listing),
      description: listing.description,
      publishedAt: listing.publishedAt?.toISOString() ?? null,
      expiresAt: listing.expiresAt?.toISOString() ?? null,
      property: {
        id: listing.property.publicId,
        title: listing.property.title,
        status: listing.property.status,
        type: listing.property.propertyType,
        surface: numberOrNull(listing.property.surface),
        landSurface: numberOrNull(listing.property.landSurface),
        bedrooms: listing.property.bedrooms,
        bathrooms: listing.property.bathrooms,
        neighborhood: listing.property.neighborhood?.name ?? null,
        commune: listing.property.neighborhood?.commune.name ?? null,
        publicPhotos: listing.property._count.media,
      },
      history: listing.statusHistory.map((row) => ({
        from: row.oldStatus,
        to: row.newStatus,
        reason: row.reason,
        changedBy: row.changedBy?.publicId ?? null,
        at: row.createdAt.toISOString(),
      })),
      reports: listing.reports.map((row) => ({
        id: row.publicId,
        reason: row.reason,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      checks,
      notes,
      decisions,
      reasons: reasonsFor(decisions, reasons),
    }
  }

  async moderate(
    actor: Actor,
    publicId: string,
    decision: ModerationDecision,
    input: ModerationInput,
    context: RequestContext,
  ): Promise<{ status: ListingStatus }> {
    const rule = MODERATION_RULES[decision]
    if (!can(actor, rule.permission)) {
      throw authError(AuthErrorCode.INSUFFICIENT_PERMISSION)
    }
    if (!rule.from.includes(input.expectedStatus)) {
      throw adminError("MODERATION_NOT_APPLICABLE")
    }
    const listing = await this.db.client.listing.findUnique({
      where: { publicId },
      select: { createdById: true, deletedAt: true },
    })
    if (!listing || listing.deletedAt) throw adminError("LISTING_NOT_FOUND")
    if (!isNotOwnListing(actor, listing.createdById)) {
      throw adminError("ADMIN_TARGET_PROTECTED", "votre propre annonce")
    }

    let reason: ModerationReasonView | null = null
    if (rule.reasonAction) {
      if (!input.reasonCode) throw adminError("MODERATION_REASON_REQUIRED")
      reason = await this.reasons.require(input.reasonCode, rule.reasonAction)
    } else if (input.reasonCode) {
      throw adminError("MODERATION_REASON_INVALID", "aucun motif attendu")
    }
    const internalNote = input.internalNote?.trim() || null
    if (rule.justificationRequired && !internalNote) {
      throw adminError("MODERATION_JUSTIFICATION_REQUIRED")
    }
    const ownerMessage = input.ownerMessage?.trim() || null

    const status = await this.listings.changeStatus(
      actor,
      publicId,
      {
        status: rule.to,
        expectedStatus: input.expectedStatus,
        ...withReason(historyReason(reason?.code ?? null, ownerMessage)),
      },
      context,
      async (tx, result) => {
        const note = internalNote
          ? await this.notes.add(
              actor,
              "listing",
              publicId,
              internalNote,
              context,
              tx,
            )
          : null
        await this.activity.audit(
          {
            action: AdminAuditAction.LISTING_MODERATED,
            actorId: actor.userId,
            entityType: "listing",
            entityId: publicId,
            oldValues: { status: result.from },
            newValues: {
              decision,
              status: result.to,
              reasonCode: reason?.code ?? null,
              ownerMessage: ownerMessage !== null,
              noteId: note?.id ?? null,
            },
          },
          context,
          tx,
        )
        await this.notifications.notify(
          result.createdById,
          {
            type: "SYSTEM",
            category: "LISTING_UPDATES",
            ...moderationNotice(
              decision,
              result.title,
              reason?.ownerMessage ?? null,
              ownerMessage,
            ),
            data: {
              listingId: publicId,
              decision,
              status: result.to,
              ...(reason ? { reasonCode: reason.code } : {}),
            },
          },
          tx,
        )
      },
    )
    this.activity.log("admin.listing_moderated", context, {
      user_id: actor.publicId,
      listing_id: publicId,
      decision,
      to: status,
    })
    return { status }
  }

  /**
   * Prix médian au m² des annonces publiées comparables (même offre, même
   * type de bien, même quartier, même période et devise de prix).
   */
  private async comparablePricePerSqm(
    listing: {
      id: bigint
      listingType: ListingType
      property: { neighborhoodId: number; propertyTypeId: number }
    },
    price: { currency: string; period: string },
  ): Promise<{ median: number; count: number } | null> {
    const rows = await this.db.client.$queryRaw<
      Array<{ median: number | null; count: number }>
    >`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY lp.amount / COALESCE(p.surface, p.land_surface)
        )::float8 AS median,
        count(*)::int AS count
      FROM listings l
      JOIN properties p ON p.id = l.property_id
      JOIN listing_prices lp ON lp.listing_id = l.id AND lp.valid_to IS NULL
      WHERE l.status = 'PUBLISHED'
        AND l.deleted_at IS NULL
        AND l.id <> ${listing.id}
        AND l.listing_type = ${listing.listingType}::listing_type
        AND p.neighborhood_id = ${listing.property.neighborhoodId}
        AND p.property_type_id = ${listing.property.propertyTypeId}
        AND lp.currency = ${price.currency}
        AND lp.period = ${price.period}::price_period
        AND COALESCE(p.surface, p.land_surface) > 0
    `
    const row = rows[0]
    return row && row.median !== null
      ? { median: row.median, count: row.count }
      : null
  }
}

function assertModerator(actor: Actor): void {
  if (!can(actor, "listing:moderate") && !can(actor, "listing:suspend")) {
    throw authError(AuthErrorCode.INSUFFICIENT_PERMISSION)
  }
}

/** Nul ne modère sa propre annonce. */
function isNotOwnListing(actor: Actor, createdById: bigint): boolean {
  return actor.userId !== createdById
}

function withReason(reason: string | null): { reason?: string } {
  return reason ? { reason } : {}
}

function numberOrNull(
  value: { toString(): string } | null | undefined,
): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function reasonsFor(
  decisions: readonly ModerationDecision[],
  reasons: readonly ModerationReasonView[],
): Partial<Record<ModerationDecision, ModerationReasonView[]>> {
  const result: Partial<Record<ModerationDecision, ModerationReasonView[]>> = {}
  for (const decision of decisions) {
    const action = MODERATION_RULES[decision].reasonAction
    if (action) {
      result[decision] = reasons.filter((reason) => reason.action === action)
    }
  }
  return result
}

function toQueueItem(row: QueueRow) {
  const price = row.prices[0] ?? null
  return {
    id: row.publicId,
    title: row.title,
    status: row.status,
    listingType: row.listingType,
    price: price
      ? {
          amount: price.amount.toString(),
          currency: price.currency,
          period: price.period,
        }
      : null,
    property: {
      id: row.property.publicId,
      type: row.property.propertyType,
      neighborhood: row.property.neighborhood?.name ?? null,
      commune: row.property.neighborhood?.commune.name ?? null,
    },
    publisher: {
      id: row.createdBy.publicId,
      name: displayName(row.createdBy),
    },
    openReports: row._count.reports,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type { AdminNoteView }
