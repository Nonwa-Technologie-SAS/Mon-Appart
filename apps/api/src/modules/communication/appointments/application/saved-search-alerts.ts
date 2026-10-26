import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { DomainEventPublisher } from "../../../../common/events/domain-event.publisher"
import { DatabaseService } from "../../../../database/database.service"
import type { Prisma } from "../../../../generated/prisma/client"
import { SearchRetentionEvent } from "../../../search/domain/saved-search-events"
import {
  digestDedupKey,
  hasAlertableCriteria,
  matchListingToSavedSearch,
  priceDropDedupKey,
  sanitizeSavedSearchParams,
  unavailableDedupKey,
  type ListingMatchInput,
  type SavedSearchCriteria,
} from "../../../search/domain/saved-search-match"
import {
  isReactivationEligible,
  utcDayKey,
  utcWeekKey,
} from "../../../search/domain/user-lifecycle"
import {
  parseSearchQuery,
  type RawSearchParams,
} from "../../../search/domain/search-query"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import { CommunicationEvent } from "../../domain/communication-events"
import { NotificationService } from "../../notifications/application/notification.service"

const SEARCH_LIMITS = {
  defaultLimit: 20,
  maxLimit: 100,
  maxRadiusKm: 50,
}

const LISTING_SELECT = {
  id: true,
  publicId: true,
  title: true,
  listingType: true,
  status: true,
  publishedAt: true,
  expiresAt: true,
  deletedAt: true,
  property: {
    select: {
      bedrooms: true,
      bathrooms: true,
      surface: true,
      propertyType: { select: { code: true } },
      neighborhood: {
        select: {
          code: true,
          commune: {
            select: { code: true, city: { select: { code: true } } },
          },
        },
      },
    },
  },
  prices: {
    where: { validTo: null },
    select: { amount: true, validFrom: true },
    take: 1,
  },
} as const satisfies Prisma.ListingSelect

type ListingRow = Prisma.ListingGetPayload<{ select: typeof LISTING_SELECT }>

/**
 * Alertes de recherches sauvegardées et de favoris. Réutilise
 * `NotificationService.notify` (préférences, consentement, déduplication).
 * SKIP LOCKED : plusieurs instances peuvent tourner.
 */
@Injectable()
export class SavedSearchAlerts {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationService,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
    private readonly events: DomainEventPublisher,
  ) {}

  async sendDue(): Promise<number> {
    const searches = await this.sendSavedSearchDigests()
    const drops = await this.sendPriceDrops()
    const gone = await this.sendUnavailableFavorites()
    return searches + drops + gone
  }

  private async sendSavedSearchDigests(): Promise<number> {
    const { batchSize, dailyMinHours, weeklyMinDays } = this.config.alerts
    const sent = await this.db.transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM saved_searches
        WHERE alerts_enabled = true
          AND frequency <> 'PAUSED'
          AND (
            (frequency = 'DAILY' AND (
              last_checked_at IS NULL
              OR last_checked_at <= now() - make_interval(hours => ${dailyMinHours}::int)
            ))
            OR (frequency = 'WEEKLY' AND (
              last_checked_at IS NULL
              OR last_checked_at <= now() - make_interval(days => ${weeklyMinDays}::int)
            ))
          )
        ORDER BY last_checked_at NULLS FIRST, id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `
      if (due.length === 0) return 0
      const rows = await tx.savedSearch.findMany({
        where: { id: { in: due.map((row) => row.id) } },
      })
      let notified = 0
      const now = new Date()
      for (const row of rows) {
        const result = await this.processSearch(tx, row, now)
        if (result) notified += 1
      }
      return notified
    })
    if (sent > 0) {
      this.activity.emit(CommunicationEvent.DELIVERIES_QUEUED, "alerts", {})
    }
    return sent
  }

  private async processSearch(
    tx: Prisma.TransactionClient,
    row: {
      id: bigint
      publicId: string
      userId: bigint
      name: string
      params: Prisma.JsonValue
      frequency: string
      cursorPublishedAt: Date | null
    },
    now: Date,
  ): Promise<boolean> {
    const preference = await tx.userPreference.findUnique({
      where: { userId: row.userId },
      select: {
        projectStatus: true,
        lastReactivationAt: true,
      },
    })
    const projectStatus = preference?.projectStatus ?? "ACTIVE"
    if (projectStatus === "COMPLETED" || projectStatus === "PAUSED") {
      await tx.savedSearch.update({
        where: { id: row.id },
        data: { lastCheckedAt: now, updatedAt: now },
      })
      return false
    }
    const user = await tx.user.findUnique({
      where: { id: row.userId },
      select: { lastLoginAt: true, status: true, deletedAt: true },
    })
    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      await tx.savedSearch.update({
        where: { id: row.id },
        data: { lastCheckedAt: now, updatedAt: now },
      })
      return false
    }
    const criteria = criteriaFromParams(row.params)
    if (!criteria || !hasAlertableCriteria(criteria)) {
      await tx.savedSearch.update({
        where: { id: row.id },
        data: { lastCheckedAt: now, alertsEnabled: false, updatedAt: now },
      })
      return false
    }
    const listings = await tx.listing.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: { gt: row.cursorPublishedAt ?? new Date(0) },
        ...(criteria.listingTypes[0]
          ? { listingType: criteria.listingTypes[0] as never }
          : {}),
      },
      select: LISTING_SELECT,
      orderBy: { publishedAt: "asc" },
      take: 40,
    })
    const exact: ListingRow[] = []
    const near: Array<{ listing: ListingRow; overBudgetAmount: number }> = []
    let cursor = row.cursorPublishedAt
    for (const listing of listings) {
      if (listing.publishedAt && (!cursor || listing.publishedAt > cursor)) {
        cursor = listing.publishedAt
      }
      const match = matchListingToSavedSearch(
        toMatchInput(listing, now),
        criteria,
      )
      if (match.kind === "exact") exact.push(listing)
      else if (
        match.kind === "near_budget" &&
        match.overBudgetAmount !== null
      ) {
        near.push({ listing, overBudgetAmount: match.overBudgetAmount })
      }
    }
    const cap = this.config.alerts.maxListingsPerDigest
    const exactIds = exact.slice(0, cap).map((item) => item.publicId)
    this.emit(SearchRetentionEvent.PROPERTY_ALERT_ELIGIBLE, row.publicId, {
      savedSearchId: row.publicId,
      exactCount: exact.length,
      nearCount: near.length,
    })
    const reactivation = isReactivationEligible({
      projectStatus,
      lastLoginAt: user.lastLoginAt,
      lastReactivationAt: preference?.lastReactivationAt ?? null,
      alertsEnabled: true,
      hasExactMatches: exactIds.length > 0,
      idleDays: this.config.alerts.reactivationIdleDays,
      cooldownDays: this.config.alerts.reactivationCooldownDays,
      now,
    })
    if (reactivation.eligible) {
      this.emit(SearchRetentionEvent.REACTIVATION_ELIGIBLE, row.publicId, {
        savedSearchId: row.publicId,
      })
    }
    let notified = false
    if (exactIds.length > 0) {
      const periodKey =
        row.frequency === "WEEKLY" ? utcWeekKey(now) : utcDayKey(now)
      const title = reactivation.eligible
        ? "De nouvelles annonces correspondent à votre recherche"
        : "Nouvelles annonces pour votre recherche"
      const nearHint =
        exactIds.length === 0 && near.length > 0
          ? null
          : near.length > 0
            ? ` ${near.length} bien(s) au-dessus du budget déclaré ne sont pas présentés comme compatibles.`
            : ""
      const dispatched = await this.notifications.notify(
        row.userId,
        {
          type: "NEW_PROPERTY",
          category: "SAVED_SEARCHES",
          title,
          body: `${exactIds.length} annonce(s) pour « ${row.name} ».${nearHint}`,
          data: {
            savedSearchId: row.publicId,
            listingIds: exactIds,
            listingCount: exactIds.length,
            overBudgetCount: near.length,
            reactivation: reactivation.eligible,
          },
          dedupKey: digestDedupKey(row.publicId, periodKey),
          expiresAt: new Date(now.getTime() + 7 * 86_400_000),
        },
        tx,
      )
      notified = dispatched !== null
      if (notified) {
        this.emit(
          reactivation.eligible
            ? SearchRetentionEvent.REACTIVATION_SENT
            : SearchRetentionEvent.PROPERTY_ALERT_SENT,
          row.publicId,
          {
            savedSearchId: row.publicId,
            listingCount: exactIds.length,
            reactivation: reactivation.eligible,
          },
        )
        if (reactivation.eligible) {
          await tx.userPreference.upsert({
            where: { userId: row.userId },
            create: {
              userId: row.userId,
              lastReactivationAt: now,
            },
            update: { lastReactivationAt: now, updatedAt: now },
          })
        }
      }
    }
    await tx.savedSearch.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: now,
        cursorPublishedAt: cursor,
        ...(notified ? { lastAlertedAt: now } : {}),
        updatedAt: now,
      },
    })
    return notified
  }

  private async sendPriceDrops(): Promise<number> {
    const now = new Date()
    const since = new Date(now.getTime() - 2 * 86_400_000)
    const rows = await this.db.client.$queryRaw<
      Array<{
        user_id: bigint
        listing_public_id: string
        listing_title: string
        valid_from: Date
        current_amount: number
        previous_amount: number
      }>
    >`
      SELECT f.user_id,
             l.public_id::text AS listing_public_id,
             l.title AS listing_title,
             current.valid_from,
             current.amount::float AS current_amount,
             previous.amount::float AS previous_amount
        FROM favorites f
        JOIN listings l
          ON l.property_id = f.property_id
         AND l.status = 'PUBLISHED'
         AND l.deleted_at IS NULL
         AND (l.expires_at IS NULL OR l.expires_at > now())
        JOIN listing_prices current
          ON current.listing_id = l.id
         AND current.valid_to IS NULL
        JOIN listing_prices previous
          ON previous.listing_id = l.id
         AND previous.valid_to = current.valid_from
       WHERE current.valid_from > ${since}
         AND current.amount < previous.amount
       LIMIT ${this.config.alerts.batchSize}
    `
    let sent = 0
    for (const row of rows) {
      const preference = await this.db.client.userPreference.findUnique({
        where: { userId: row.user_id },
        select: { projectStatus: true },
      })
      if (preference?.projectStatus === "COMPLETED") continue
      const dispatched = await this.notifications.notify(row.user_id, {
        type: "PRICE_DROP",
        category: "PRICE_DROPS",
        title: "Le prix d'un favori a baissé",
        body: `« ${row.listing_title} »`,
        data: {
          listingId: row.listing_public_id,
        },
        dedupKey: priceDropDedupKey(
          row.listing_public_id,
          row.valid_from.toISOString(),
        ),
        expiresAt: new Date(now.getTime() + 7 * 86_400_000),
      })
      if (dispatched) sent += 1
    }
    if (sent > 0) {
      this.activity.emit(
        CommunicationEvent.DELIVERIES_QUEUED,
        "price-drops",
        {},
      )
    }
    return sent
  }

  private async sendUnavailableFavorites(): Promise<number> {
    const now = new Date()
    const rows = await this.db.client.$queryRaw<
      Array<{
        user_id: bigint
        listing_public_id: string
        listing_title: string
      }>
    >`
      SELECT f.user_id,
             l.public_id::text AS listing_public_id,
             l.title AS listing_title
        FROM favorites f
        JOIN listings l
          ON l.property_id = f.property_id
         AND l.deleted_at IS NULL
       WHERE l.status <> 'PUBLISHED'
          OR (l.expires_at IS NOT NULL AND l.expires_at <= now())
       LIMIT ${this.config.alerts.batchSize}
    `
    let sent = 0
    for (const row of rows) {
      const preference = await this.db.client.userPreference.findUnique({
        where: { userId: row.user_id },
        select: { projectStatus: true },
      })
      if (preference?.projectStatus === "COMPLETED") continue
      const dispatched = await this.notifications.notify(row.user_id, {
        type: "SYSTEM",
        category: "LISTING_UPDATES",
        title: "Un bien suivi n'est plus disponible",
        body: `« ${row.listing_title} »`,
        data: { listingId: row.listing_public_id },
        dedupKey: unavailableDedupKey(row.listing_public_id),
        expiresAt: new Date(now.getTime() + 14 * 86_400_000),
      })
      if (dispatched) {
        sent += 1
        this.emit(
          SearchRetentionEvent.PROPERTY_MARKED_UNAVAILABLE,
          row.listing_public_id,
          {
            listingId: row.listing_public_id,
          },
        )
      }
    }
    if (sent > 0) {
      this.activity.emit(
        CommunicationEvent.DELIVERIES_QUEUED,
        "unavailable-favorites",
        {},
      )
    }
    return sent
  }

  private emit(
    name: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): void {
    this.events.publish({
      id: randomUUID(),
      name,
      occurredAt: new Date().toISOString(),
      aggregateId,
      payload,
    })
  }
}

function criteriaFromParams(
  value: Prisma.JsonValue,
): SavedSearchCriteria | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const params = sanitizeSavedSearchParams(value as Record<string, unknown>)
  try {
    const query = parseSearchQuery(params as RawSearchParams, SEARCH_LIMITS)
    return {
      listingTypes: query.listingTypes,
      propertyTypes: query.propertyTypes,
      cities: query.cities,
      communes: query.communes,
      neighborhoods: query.neighborhoods,
      minPrice: query.price.min,
      maxPrice: query.price.max,
      minSurface: query.surface.min,
      maxSurface: query.surface.max,
      minBedrooms: query.bedrooms.min,
      minBathrooms: query.bathrooms.min,
    }
  } catch {
    return null
  }
}

function toMatchInput(listing: ListingRow, now: Date): ListingMatchInput {
  const neighborhood = listing.property.neighborhood
  return {
    status: listing.status,
    deletedAt: listing.deletedAt,
    expiresAt: listing.expiresAt,
    publishedAt: listing.publishedAt,
    listingType: listing.listingType,
    propertyTypeCode: listing.property.propertyType.code,
    cityCode: neighborhood.commune.city.code,
    communeCode: neighborhood.commune.code,
    neighborhoodCode: neighborhood.code,
    priceAmount: listing.prices[0]
      ? Number(listing.prices[0].amount.toString())
      : null,
    bedrooms: listing.property.bedrooms,
    bathrooms: listing.property.bathrooms,
    surface: listing.property.surface
      ? Number(listing.property.surface.toString())
      : null,
    now,
  }
}
