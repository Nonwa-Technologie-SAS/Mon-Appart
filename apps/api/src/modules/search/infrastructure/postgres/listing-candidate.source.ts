import { Injectable } from "@nestjs/common"
import type { ListingType } from "@mon-appart/types"

import { DatabaseService } from "../../../../database/database.service"
import {
  Prisma,
  type PricePeriod,
  type PropertyCategory,
} from "../../../../generated/prisma/client"
import { publishedPointSql } from "../../../property"
import { SearchConfig } from "../../search.config"
import { PostgresSearchQueryBuilder } from "./postgres-search-query"

/** Filtres stricts du pool : jamais assouplis par le scoring. */
export interface CandidateCriteria {
  listingTypes: ListingType[]
  /** Prix comparables seulement : même devise, même périodicité. */
  price: {
    currency: string
    period: PricePeriod
    min: number | null
    max: number | null
  } | null
  propertyTypeIds: number[]
  propertyCategory: PropertyCategory | null
  /** `null` : pas de filtre ; tableau vide : aucun candidat possible. */
  neighborhoodIds: number[] | null
  cityIds: number[] | null
  excludeListingIds: bigint[]
  excludePropertyIds: bigint[]
  /** Restreint à une annonce (lecture de la référence des annonces similaires). */
  publicId: string | null
  /** Annonces publiées par ce compte écartées (on ne recommande pas ses propres biens). */
  excludeCreatedById: bigint | null
  /** Rapproche le pool des préférences sans filtrer : un gros catalogue reste pertinent. */
  boost: {
    neighborhoodIds: number[]
    communeIds: number[]
    propertyTypeIds: number[]
  }
  /** Point de référence : distance calculée depuis la position publiée. */
  point: { latitude: number; longitude: number } | null
  asOf: Date
  limit: number
}

export interface ListingCandidate {
  listingId: bigint
  publicId: string
  propertyId: bigint
  createdById: bigint
  listingType: ListingType
  propertyTypeId: number
  propertyTypeCode: string
  propertyCategory: PropertyCategory
  neighborhoodId: number
  communeId: number
  cityId: number
  price: { amount: number; currency: string; period: PricePeriod }
  surface: number | null
  landSurface: number | null
  bedrooms: number | null
  bathrooms: number | null
  publishedAt: Date
  /** 0..1, complétude (projection de recherche). */
  qualityScore: number
  distanceMeters: number | null
  amenityCodes: string[]
  /** Consultations des 30 derniers jours. */
  recentViews: number
}

interface CandidateRow {
  id: bigint
  public_id: string
  property_id: bigint
  created_by_id: bigint
  listing_type: ListingType
  property_type_id: number
  property_type_code: string
  property_category: PropertyCategory
  neighborhood_id: number
  commune_id: number
  city_id: number
  amount: Prisma.Decimal
  currency: string
  period: PricePeriod
  surface: Prisma.Decimal | null
  land_surface: Prisma.Decimal | null
  bedrooms: number | null
  bathrooms: number | null
  published_at: Date
  quality: number
  distance_m: number | null
  amenity_codes: string[] | null
  recent_views: number
}

const POPULARITY_WINDOW_DAYS = 30

const toNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : Number(value.toString())

/**
 * Pool de candidats pour les recommandations. Réutilise les règles de
 * visibilité de la recherche publique ; prix courant obligatoire. Une requête
 * paramétrée, caractéristiques chargées en lot sur le seul pool.
 */
@Injectable()
export class ListingCandidateSource {
  private readonly builder: PostgresSearchQueryBuilder

  constructor(
    private readonly db: DatabaseService,
    config: SearchConfig,
  ) {
    this.builder = new PostgresSearchQueryBuilder(config.synonyms)
  }

  async find(criteria: CandidateCriteria): Promise<ListingCandidate[]> {
    const where = this.where(criteria)
    if (!where || criteria.limit <= 0) return []
    const origin = criteria.point
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${criteria.point.longitude}::float8, ${criteria.point.latitude}::float8), 4326)::geography`
      : null
    const distance = origin
      ? Prisma.sql`ST_Distance(${publishedPointSql("p")}, ${origin})`
      : Prisma.sql`NULL::float8`
    const since = new Date(
      criteria.asOf.getTime() - POPULARITY_WINDOW_DAYS * 86_400_000,
    )

    const rows = await this.db.client.$queryRaw<CandidateRow[]>`
      WITH pool AS (
        SELECT l.id, l.public_id::text AS public_id, l.property_id, l.created_by_id,
               l.listing_type, l.published_at, p.property_type_id, p.neighborhood_id,
               p.surface, p.land_surface, p.bedrooms, p.bathrooms,
               lp.amount, lp.currency, lp.period,
               COALESCE(d.quality_score, 0)::float8 AS quality,
               ${distance} AS distance_m,
               ${this.poolScore(criteria, distance)} AS pool_score
        FROM listings l
          JOIN properties p ON p.id = l.property_id
          JOIN listing_prices lp ON lp.listing_id = l.id AND lp.valid_to IS NULL
          JOIN neighborhoods n ON n.id = p.neighborhood_id
          JOIN communes c ON c.id = n.commune_id
          JOIN property_types pt ON pt.id = p.property_type_id
          LEFT JOIN listing_search_documents d ON d.listing_id = l.id
        WHERE ${where}
        ORDER BY pool_score DESC, l.id DESC
        LIMIT ${criteria.limit}
      )
      SELECT pool.*, pt.code AS property_type_code, pt.category AS property_category,
             n.commune_id, c.city_id,
             (SELECT array_agg(a.code ORDER BY a.code) FROM property_amenities pa
                JOIN amenities a ON a.id = pa.amenity_id
               WHERE pa.property_id = pool.property_id) AS amenity_codes,
             (SELECT count(*) FROM property_views v
               WHERE v.property_id = pool.property_id AND v.created_at >= ${since}::timestamptz)::int AS recent_views
      FROM pool
        JOIN property_types pt ON pt.id = pool.property_type_id
        JOIN neighborhoods n ON n.id = pool.neighborhood_id
        JOIN communes c ON c.id = n.commune_id
      ORDER BY pool.pool_score DESC, pool.id DESC
    `
    return rows.map((row) => ({
      listingId: row.id,
      publicId: row.public_id,
      propertyId: row.property_id,
      createdById: row.created_by_id,
      listingType: row.listing_type,
      propertyTypeId: row.property_type_id,
      propertyTypeCode: row.property_type_code,
      propertyCategory: row.property_category,
      neighborhoodId: row.neighborhood_id,
      communeId: row.commune_id,
      cityId: row.city_id,
      price: {
        amount: Number(row.amount.toString()),
        currency: row.currency,
        period: row.period,
      },
      surface: toNumber(row.surface),
      landSurface: toNumber(row.land_surface),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      publishedAt: row.published_at,
      qualityScore: Number(row.quality),
      distanceMeters: row.distance_m === null ? null : Number(row.distance_m),
      amenityCodes: row.amenity_codes ?? [],
      recentViews: Number(row.recent_views),
    }))
  }

  private where(criteria: CandidateCriteria): Prisma.Sql | null {
    const conditions = this.builder.publicConditions()
    conditions.push(Prisma.sql`lp.amount > 0`)
    if (criteria.listingTypes.length > 0) {
      conditions.push(
        Prisma.sql`l.listing_type IN (${Prisma.join(criteria.listingTypes.map((type) => Prisma.sql`${type}::listing_type`))})`,
      )
    }
    if (criteria.price) {
      const { currency, period, min, max } = criteria.price
      conditions.push(
        Prisma.sql`lp.currency = ${currency}`,
        Prisma.sql`lp.period = ${period}::price_period`,
      )
      if (min !== null) conditions.push(Prisma.sql`lp.amount >= ${min}`)
      if (max !== null) conditions.push(Prisma.sql`lp.amount <= ${max}`)
    }
    if (criteria.propertyTypeIds.length > 0) {
      conditions.push(
        Prisma.sql`p.property_type_id IN (${Prisma.join(criteria.propertyTypeIds)})`,
      )
    }
    if (criteria.propertyCategory) {
      conditions.push(
        Prisma.sql`pt.category = ${criteria.propertyCategory}::property_category`,
      )
    }
    if (criteria.neighborhoodIds) {
      if (criteria.neighborhoodIds.length === 0) return null
      conditions.push(
        Prisma.sql`p.neighborhood_id IN (${Prisma.join(criteria.neighborhoodIds)})`,
      )
    }
    if (criteria.cityIds) {
      if (criteria.cityIds.length === 0) return null
      conditions.push(
        Prisma.sql`c.city_id IN (${Prisma.join(criteria.cityIds)})`,
      )
    }
    if (criteria.excludeListingIds.length > 0) {
      conditions.push(
        Prisma.sql`l.id NOT IN (${Prisma.join(criteria.excludeListingIds)})`,
      )
    }
    if (criteria.excludePropertyIds.length > 0) {
      conditions.push(
        Prisma.sql`l.property_id NOT IN (${Prisma.join(criteria.excludePropertyIds)})`,
      )
    }
    if (criteria.publicId !== null) {
      conditions.push(Prisma.sql`l.public_id = ${criteria.publicId}::uuid`)
    }
    if (criteria.excludeCreatedById !== null) {
      conditions.push(
        Prisma.sql`l.created_by_id <> ${criteria.excludeCreatedById}`,
      )
    }
    return Prisma.join(conditions, " AND ")
  }

  /** Ordre du pool seulement ; le classement final est fait par le moteur. */
  private poolScore(
    criteria: CandidateCriteria,
    distance: Prisma.Sql,
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [
      Prisma.sql`0.4 * ${this.builder.freshness(criteria.asOf)}`,
      Prisma.sql`0.3 * COALESCE(d.quality_score, 0)`,
    ]
    const { boost } = criteria
    if (boost.neighborhoodIds.length > 0) {
      parts.push(
        Prisma.sql`CASE WHEN p.neighborhood_id IN (${Prisma.join(boost.neighborhoodIds)}) THEN 1 ELSE 0 END`,
      )
    }
    if (boost.communeIds.length > 0) {
      parts.push(
        Prisma.sql`CASE WHEN n.commune_id IN (${Prisma.join(boost.communeIds)}) THEN 0.6 ELSE 0 END`,
      )
    }
    if (boost.propertyTypeIds.length > 0) {
      parts.push(
        Prisma.sql`CASE WHEN p.property_type_id IN (${Prisma.join(boost.propertyTypeIds)}) THEN 0.5 ELSE 0 END`,
      )
    }
    if (criteria.point) {
      parts.push(
        Prisma.sql`COALESCE(GREATEST(0, 1 - ${distance} / 20000.0), 0)`,
      )
    }
    return Prisma.sql`(${Prisma.join(parts, " + ")})::float8`
  }
}
