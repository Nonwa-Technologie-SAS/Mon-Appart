import { Injectable } from "@nestjs/common"
import { METRICS_CATALOG } from "@mon-appart/analytics"

import {
  ActorService,
  can,
  type Actor,
  type AuthenticatedUser,
} from "../../identity"
import { MANAGING_RELATIONS, PropertyAccessService } from "../../property"
import { AnalyticsConfig } from "../analytics.config"
import { analyticsError } from "../domain/analytics-errors"
import {
  parseDateRange,
  ratio,
  thresholdGroups,
  type DateRange,
} from "../domain/date-range"
import { isoDay } from "../domain/ingestion-rules"
import {
  applySupplyThreshold,
  type SupplyBucket,
} from "../domain/market-stats"
import { AnalyticsRepository } from "../infrastructure/analytics.repository"
import { AGGREGATE_JOB } from "./aggregation.service"

export interface RangeQuery {
  from?: string
  to?: string
}

interface MetricRow {
  metric: string
  dimension: string
  value: string
  count: number
  actors: number
}

const LISTING_COUNTERS = [
  "detailViews",
  "uniqueViewers",
  "cardImpressions",
  "shares",
  "contactsStarted",
  "contactsSubmitted",
  "appointmentsRequested",
  "appointmentsConfirmed",
  "appointmentsCompleted",
  "qualifiedLeads",
  "recommendationImpressions",
  "recommendationOpens",
] as const

type ListingCounter = (typeof LISTING_COUNTERS)[number]
export type ListingTotals = Record<ListingCounter, number>

const FUNNEL_STEPS = [
  "1_VISIT",
  "2_RESULTS",
  "3_DETAIL",
  "4_CONTACT_STARTED",
  "5_CONTACT_SUBMITTED",
  "6_APPOINTMENT_REQUESTED",
  "7_APPOINTMENT_COMPLETED",
  "8_QUALIFIED_LEAD",
] as const

const KPIS = [
  "kpi.registrations",
  "kpi.listings_created",
  "kpi.listings_published",
  "kpi.contacts",
  "kpi.appointments_requested",
  "kpi.appointments_confirmed",
  "kpi.appointments_completed",
  "kpi.qualified_leads",
] as const

/**
 * Lectures sur les agrégats uniquement : jamais d'événement brut, jamais
 * d'identifiant de visiteur. Les gestionnaires ne voient que leurs annonces.
 */
@Injectable()
export class AnalyticsQueryService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly actors: ActorService,
    private readonly access: PropertyAccessService,
    private readonly config: AnalyticsConfig,
  ) {}

  range(query: RangeQuery): DateRange {
    return parseDateRange(query, {
      defaultDays: this.config.defaultRangeDays,
      maxDays: this.config.maxRangeDays,
    })
  }

  // ------------------------------------------------------------ gestionnaires

  async listing(
    user: AuthenticatedUser,
    listingPublicId: string,
    query: RangeQuery,
  ) {
    const range = this.range(query)
    const actor = await this.actors.resolve(user)
    const listing = await this.repository.client.listing.findFirst({
      where: { publicId: listingPublicId, deletedAt: null },
      select: {
        id: true,
        publicId: true,
        propertyId: true,
        status: true,
        title: true,
      },
    })
    if (!listing) throw analyticsError("LISTING_NOT_FOUND")
    const { decision } = await this.access.decide(actor, {
      propertyId: listing.propertyId,
      permission: "analytics:read",
      override: "analytics:admin",
      relations: MANAGING_RELATIONS,
      publiclyVisible: false,
    })
    // Jamais de 403 : l'existence d'une annonce non gérée n'est pas révélée.
    if (decision !== "ALLOW" && decision !== "ALLOW_OVERRIDE") {
      throw analyticsError("LISTING_NOT_FOUND")
    }
    const rows = await this.repository.client.analyticsListingDaily.findMany({
      where: { listingId: listing.id, day: { gte: range.from, lte: range.to } },
      orderBy: { day: "asc" },
    })
    const totals = emptyTotals()
    const series = rows.map((row) => {
      const point = pickCounters(row)
      for (const key of LISTING_COUNTERS) totals[key] += point[key]
      return { day: isoDay(row.day), ...point }
    })
    return {
      listing: {
        id: listing.publicId,
        title: listing.title,
        status: listing.status,
      },
      range: rangeView(range),
      totals,
      rates: listingRates(totals),
      series,
      meta: await this.freshness(),
    }
  }

  async myListings(
    user: AuthenticatedUser,
    query: RangeQuery & { page?: number; limit?: number },
  ) {
    const range = this.range(query)
    const actor = await this.actors.resolve(user)
    if (!canRead(actor)) return this.emptyPage(range, query)
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
    const page = Math.max(query.page ?? 1, 1)
    const where = {
      deletedAt: null,
      property: {
        ownerships: {
          some: {
            ownerId: actor.userId,
            isCurrent: true,
            ownershipType: { in: [...MANAGING_RELATIONS] },
          },
        },
      },
    }
    const [total, listings] = await Promise.all([
      this.repository.client.listing.count({ where }),
      this.repository.client.listing.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, publicId: true, title: true, status: true },
      }),
    ])
    const sums = listings.length
      ? await this.repository.client.analyticsListingDaily.groupBy({
          by: ["listingId"],
          where: {
            listingId: { in: listings.map((listing) => listing.id) },
            day: { gte: range.from, lte: range.to },
          },
          _sum: Object.fromEntries(
            LISTING_COUNTERS.map((key) => [key, true]),
          ) as Record<ListingCounter, true>,
        })
      : []
    const byListing = new Map(sums.map((row) => [row.listingId, row._sum]))
    return {
      range: rangeView(range),
      items: listings.map((listing) => {
        const sum = byListing.get(listing.id)
        const totals = emptyTotals()
        for (const key of LISTING_COUNTERS) totals[key] = sum?.[key] ?? 0
        return {
          listing: {
            id: listing.publicId,
            title: listing.title,
            status: listing.status,
          },
          totals,
          rates: listingRates(totals),
        }
      }),
      pagination: { page, limit, total },
      meta: await this.freshness(),
    }
  }

  // -------------------------------------------------------- administration

  async overview(query: RangeQuery) {
    const range = this.range(query)
    const rows = await this.metrics(range, {
      metric: {
        in: [
          ...KPIS,
          "event.app_opened",
          "event.listing_detail_viewed",
          "kpi.reply_median_seconds",
        ],
      },
      dimension: "",
    })
    const total = (metric: string) =>
      rows.find((row) => row.metric === metric)?.count ?? 0
    const kpis = Object.fromEntries(
      KPIS.map((metric) => [metric.slice(4), total(metric)]),
    )
    const daily = await this.repository.client.analyticsDailyMetric.findMany({
      where: {
        day: { gte: range.from, lte: range.to },
        metric: { in: ["kpi.reply_median_seconds", "event.app_opened"] },
        dimension: "",
      },
      select: { day: true, metric: true, count: true, actors: true },
      orderBy: { day: "asc" },
    })
    const replies = daily.filter(
      (row) => row.metric === "kpi.reply_median_seconds",
    )
    return {
      range: rangeView(range),
      kpis: {
        ...kpis,
        consentedVisitorDays:
          rows.find((row) => row.metric === "event.app_opened")?.actors ?? 0,
        listingDetailViews: total("event.listing_detail_viewed"),
        contactToAppointmentRate: ratio(
          total("kpi.appointments_requested"),
          total("kpi.contacts"),
        ),
        appointmentCompletionRate: ratio(
          total("kpi.appointments_completed"),
          total("kpi.appointments_requested"),
        ),
      },
      replyMedianSecondsByDay: replies.map((row) => ({
        day: isoDay(row.day),
        medianSeconds: Number(row.count),
        replies: Number(row.actors),
      })),
      meta: await this.freshness(),
    }
  }

  async funnel(query: RangeQuery) {
    const range = this.range(query)
    const rows = await this.metrics(range, {
      metric: "funnel",
      dimension: "step",
    })
    const steps = FUNNEL_STEPS.map((step) => ({
      step,
      actorDays: rows.find((row) => row.value === step)?.actors ?? 0,
    }))
    return {
      range: rangeView(range),
      unit: "actor_day",
      steps: steps.map((step, index) => ({
        ...step,
        fromPrevious:
          index === 0
            ? null
            : ratio(step.actorDays, steps[index - 1]!.actorDays),
        fromStart: ratio(step.actorDays, steps[0]!.actorDays),
      })),
      meta: await this.freshness(),
    }
  }

  async search(query: RangeQuery) {
    const range = this.range(query)
    const rows = await this.metrics(range, {
      metric: {
        in: ["search.submitted", "search.zero_results", "search.filter"],
      },
    })
    const pick = (metric: string, dimension: string) =>
      rows.filter((row) => row.metric === metric && row.dimension === dimension)
    const totalOf = (metric: string) => pick(metric, "")[0]?.count ?? 0
    const submitted = totalOf("search.submitted")
    const zero = totalOf("search.zero_results")
    const min = this.config.minGroupSize
    return {
      range: rangeView(range),
      submitted,
      zeroResults: zero,
      zeroResultRate: ratio(zero, submitted),
      byCommune: thresholdGroups(pick("search.submitted", "commune"), min),
      zeroResultsByCommune: thresholdGroups(
        pick("search.zero_results", "commune"),
        min,
      ),
      byListingType: thresholdGroups(
        pick("search.submitted", "listing_type"),
        min,
      ),
      byPropertyType: thresholdGroups(
        pick("search.submitted", "property_type"),
        min,
      ),
      byBudget: thresholdGroups(pick("search.submitted", "budget"), min),
      filterUsage: thresholdGroups(pick("search.filter", "filter"), min),
      meta: await this.freshness(),
    }
  }

  async recommendations(query: RangeQuery) {
    const range = this.range(query)
    const rows = await this.metrics(range, {
      OR: [{ metric: { startsWith: "reco." } }],
    })
    const algorithms = [
      ...new Set(
        rows
          .filter((row) => row.dimension === "algorithm")
          .map((row) => row.value),
      ),
    ].sort()
    const value = (metric: string, algorithm: string) =>
      rows.find(
        (row) =>
          row.metric === metric &&
          row.dimension === "algorithm" &&
          row.value === algorithm,
      )?.count ?? 0
    return {
      range: rangeView(range),
      byAlgorithm: algorithms.map((algorithm) => {
        const impressions = value("reco.impressions", algorithm)
        const opens = value("reco.opens", algorithm)
        const conversions = value("reco.conversions", algorithm)
        return {
          algorithmVersion: algorithm,
          requests: value("reco.requested", algorithm),
          itemsServed: value("reco.items_served", algorithm),
          impressions,
          opens,
          conversions,
          dismissed: value("reco.dismissed", algorithm),
          // Taux de clic sur l'exposition réelle, jamais sur la génération.
          clickThroughRate: ratio(opens, impressions),
          conversionRate: ratio(conversions, opens),
        }
      }),
      feedback: rows
        .filter((row) => row.metric === "reco.feedback")
        .map((row) => ({ feedback: row.value, count: row.count })),
      meta: await this.freshness(),
    }
  }

  /** Catalogue d’indicateurs (définitions, pas de chiffres). */
  metricsCatalog() {
    return {
      metrics: METRICS_CATALOG,
      meta: {
        version: "2026-10-bi-v1",
        note: "Les UIs doivent utiliser ces définitions ; ne pas recalculer côté client.",
      },
    }
  }

  /**
   * Snapshot offre / prix des annonces publiées.
   * Instantané on-demand — distinct des agrégats journaliers de demande (search).
   */
  async market() {
    const min = this.config.minGroupSize
    const totals = await this.repository.client.$queryRaw<
      Array<{ active_listings: bigint; distinct_properties: bigint }>
    >`
      SELECT COUNT(*)::bigint AS active_listings,
             COUNT(DISTINCT l.property_id)::bigint AS distinct_properties
        FROM listings l
        JOIN properties p ON p.id = l.property_id
       WHERE l.deleted_at IS NULL
         AND l.status = 'PUBLISHED'
         AND (l.expires_at IS NULL OR l.expires_at > NOW())
         AND p.deleted_at IS NULL
         AND p.status = 'ACTIVE'
    `
    const byType = await this.repository.client.$queryRaw<
      Array<{ value: string; count: bigint }>
    >`
      SELECT l.listing_type::text AS value, COUNT(*)::bigint AS count
        FROM listings l
        JOIN properties p ON p.id = l.property_id
       WHERE l.deleted_at IS NULL
         AND l.status = 'PUBLISHED'
         AND (l.expires_at IS NULL OR l.expires_at > NOW())
         AND p.deleted_at IS NULL
         AND p.status = 'ACTIVE'
       GROUP BY l.listing_type
       ORDER BY count DESC
    `
    const byCommune = await this.repository.client.$queryRaw<
      Array<{ value: string; count: bigint }>
    >`
      SELECT c.code AS value, COUNT(*)::bigint AS count
        FROM listings l
        JOIN properties p ON p.id = l.property_id
        JOIN neighborhoods n ON n.id = p.neighborhood_id
        JOIN communes c ON c.id = n.commune_id
       WHERE l.deleted_at IS NULL
         AND l.status = 'PUBLISHED'
         AND (l.expires_at IS NULL OR l.expires_at > NOW())
         AND p.deleted_at IS NULL
         AND p.status = 'ACTIVE'
       GROUP BY c.code
       ORDER BY count DESC
    `
    const priceRows = await this.repository.client.$queryRaw<
      Array<{
        commune: string
        listing_type: string
        property_type: string
        period: string
        listings: bigint
        median: number | null
        p25: number | null
        p75: number | null
      }>
    >`
      SELECT c.code AS commune,
             l.listing_type::text AS listing_type,
             pt.code AS property_type,
             lp.period::text AS period,
             COUNT(*)::bigint AS listings,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY lp.amount::float8) AS median,
             percentile_cont(0.25) WITHIN GROUP (ORDER BY lp.amount::float8) AS p25,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY lp.amount::float8) AS p75
        FROM listings l
        JOIN listing_prices lp ON lp.listing_id = l.id AND lp.valid_to IS NULL
        JOIN properties p ON p.id = l.property_id
        JOIN neighborhoods n ON n.id = p.neighborhood_id
        JOIN communes c ON c.id = n.commune_id
        JOIN property_types pt ON pt.id = p.property_type_id
       WHERE l.deleted_at IS NULL
         AND l.status = 'PUBLISHED'
         AND (l.expires_at IS NULL OR l.expires_at > NOW())
         AND p.deleted_at IS NULL
         AND p.status = 'ACTIVE'
         AND lp.amount > 0
       GROUP BY c.code, l.listing_type, pt.code, lp.period
    `

    const buckets: SupplyBucket[] = priceRows.map((row) => ({
      commune: row.commune,
      listingType: row.listing_type,
      propertyType: row.property_type,
      period: row.period,
      listings: Number(row.listings),
      median: row.median == null ? null : Number(row.median),
      p25: row.p25 == null ? null : Number(row.p25),
      p75: row.p75 == null ? null : Number(row.p75),
    }))
    const { kept, suppressedGroups } = applySupplyThreshold(buckets, min)

    const communeGroups = byCommune.map((row) => ({
      value: row.value,
      count: Number(row.count),
      actors: Number(row.count),
    }))

    return {
      stock: {
        activeListings: Number(totals[0]?.active_listings ?? 0),
        distinctProperties: Number(totals[0]?.distinct_properties ?? 0),
        byListingType: byType.map((row) => ({
          value: row.value,
          count: Number(row.count),
        })),
        byCommune: thresholdGroups(communeGroups, min).map((row) => ({
          value: row.value,
          count: row.count,
        })),
      },
      prices: {
        currency: "XOF",
        buckets: kept,
        suppressedGroups,
      },
      disclaimer:
        "Prix et volumes observés sur les annonces Mon Appart uniquement. Ce ne sont pas des prix de transaction conclus ni une représentation exhaustive du marché immobilier ivoirien. Location mensuelle, journalière et vente ne sont jamais mélangées.",
      meta: {
        freshness: "on_demand_snapshot" as const,
        computedAt: new Date().toISOString(),
        minGroupSize: min,
      },
    }
  }

  /**
   * Vue direction : réutilise overview + search + stock marché.
   * Aucun chiffre inventé ; billing reste sur /admin/billing/summary.
   */
  async direction(query: RangeQuery) {
    const [overview, search, market] = await Promise.all([
      this.overview(query),
      this.search(query),
      this.market(),
    ])
    return {
      range: overview.range,
      platform: overview.kpis,
      demand: {
        searchesSubmitted: search.submitted,
        zeroResults: search.zeroResults,
        zeroResultRate: search.zeroResultRate,
        byCommune: search.byCommune,
        byListingType: search.byListingType,
      },
      supply: market.stock,
      priceSignal: {
        bucketCount: market.prices.buckets.length,
        suppressedGroups: market.prices.suppressedGroups,
        sample: market.prices.buckets.slice(0, 8),
      },
      meta: {
        ...overview.meta,
        marketComputedAt: market.meta.computedAt,
        billingNote:
          "Revenus plateforme : GET /api/v1/admin/billing/summary (encaissé brut, pas revenu net).",
        disclaimer: market.disclaimer,
      },
    }
  }

  async quality(query: RangeQuery) {
    const range = this.range(query)
    const stats = await this.repository.client.analyticsIngestionStat.groupBy({
      by: ["source", "outcome", "reason"],
      where: { day: { gte: range.from, lte: range.to } },
      _sum: { count: true },
    })
    const checkpoint =
      await this.repository.client.analyticsCheckpoint.findUnique({
        where: { job: AGGREGATE_JOB },
      })
    const items = stats.map((row) => ({
      source: row.source,
      outcome: row.outcome,
      reason: row.reason || null,
      count: Number(row._sum.count ?? 0),
    }))
    const received = items.reduce((sum, row) => sum + row.count, 0)
    const rejected = items
      .filter((row) => row.outcome === "rejected")
      .reduce((sum, row) => sum + row.count, 0)
    return {
      range: rangeView(range),
      ingestion: items.sort((a, b) => b.count - a.count),
      rejectionRate: ratio(rejected, received),
      aggregation: {
        completedDay: checkpoint?.completedDay
          ? isoDay(checkpoint.completedDay)
          : null,
        lastRunAt: checkpoint?.lastRunAt?.toISOString() ?? null,
        lastSuccessAt: checkpoint?.lastSuccessAt?.toISOString() ?? null,
        lastError: checkpoint?.lastError ?? null,
        durationMs: checkpoint?.durationMs ?? null,
      },
    }
  }

  // ---------------------------------------------------------------- internes

  private async metrics(
    range: DateRange,
    where: Record<string, unknown>,
  ): Promise<MetricRow[]> {
    const rows = await this.repository.client.analyticsDailyMetric.groupBy({
      by: ["metric", "dimension", "value"],
      where: { day: { gte: range.from, lte: range.to }, ...where },
      _sum: { count: true, actors: true },
    })
    return rows.map((row) => ({
      metric: row.metric,
      dimension: row.dimension,
      value: row.value,
      count: Number(row._sum.count ?? 0),
      actors: Number(row._sum.actors ?? 0),
    }))
  }

  private async freshness() {
    const checkpoint =
      await this.repository.client.analyticsCheckpoint.findUnique({
        where: { job: AGGREGATE_JOB },
        select: { lastSuccessAt: true, completedDay: true },
      })
    return {
      computedAt: checkpoint?.lastSuccessAt?.toISOString() ?? null,
      completedDay: checkpoint?.completedDay
        ? isoDay(checkpoint.completedDay)
        : null,
    }
  }

  private async emptyPage(
    range: DateRange,
    query: { page?: number; limit?: number },
  ) {
    return {
      range: rangeView(range),
      items: [],
      pagination: {
        page: Math.max(query.page ?? 1, 1),
        limit: Math.min(Math.max(query.limit ?? 20, 1), 100),
        total: 0,
      },
      meta: await this.freshness(),
    }
  }
}

function canRead(actor: Actor): boolean {
  return can(actor, "analytics:read") || can(actor, "analytics:admin")
}

function rangeView(range: DateRange) {
  return { from: isoDay(range.from), to: isoDay(range.to), days: range.days }
}

function emptyTotals(): ListingTotals {
  return Object.fromEntries(
    LISTING_COUNTERS.map((key) => [key, 0]),
  ) as ListingTotals
}

function pickCounters(row: ListingTotals): ListingTotals {
  return Object.fromEntries(
    LISTING_COUNTERS.map((key) => [key, row[key]]),
  ) as ListingTotals
}

function listingRates(totals: ListingTotals) {
  return {
    contactRate: ratio(totals.contactsSubmitted, totals.detailViews),
    appointmentRate: ratio(
      totals.appointmentsRequested,
      totals.contactsSubmitted,
    ),
    recommendationClickThroughRate: ratio(
      totals.recommendationOpens,
      totals.recommendationImpressions,
    ),
  }
}
