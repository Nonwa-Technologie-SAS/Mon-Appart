import { Injectable } from "@nestjs/common"
import type { DependencyCheck, Suggestion } from "@mon-appart/types"

import { DatabaseService } from "../../../../database/database.service"
import { Prisma } from "../../../../generated/prisma/client"
import {
  FACET_SAMPLE_CAP,
  TOTAL_COUNT_CAP,
  type EngineSearchResult,
  type RawFacetCounts,
  type ResolvedSearch,
  type SearchEngine,
  type SuggestInput,
} from "../../domain/search-engine"
import { SearchConfig } from "../../search.config"
import { SuggestionProvider } from "../suggestion.provider"
import { PostgresSearchQueryBuilder } from "./postgres-search-query"

interface HitRow {
  listing_id: string
  sort_key: string | null
  score: number | null
  distance_m: number | null
}

interface FacetRow {
  f: string
  k: string
  n: number
}

/** Bucket « 5 chambres et plus ». */
export const BEDROOMS_FACET_MAX = 5

/**
 * Moteur de référence : PostgreSQL seul (plein texte pondéré, trigrammes,
 * PostGIS, keyset). Toujours disponible, il sert aussi de repli.
 */
@Injectable()
export class PostgresSearchEngine implements SearchEngine {
  readonly name = "postgres" as const
  private readonly builder: PostgresSearchQueryBuilder

  constructor(
    private readonly db: DatabaseService,
    private readonly config: SearchConfig,
    private readonly suggestions: SuggestionProvider,
  ) {
    this.builder = new PostgresSearchQueryBuilder(config.synonyms)
  }

  async search(request: ResolvedSearch): Promise<EngineSearchResult> {
    const where = this.builder.where(request)
    const firstPage = request.cursor === null
    if (!where) {
      return {
        hits: [],
        hasMore: false,
        total: firstPage
          ? { value: 0, strategy: "exact" }
          : { value: null, strategy: "not_available" },
        facets: request.query.facets.length > 0 ? {} : null,
      }
    }
    const [hits, total, facets] = await Promise.all([
      this.hits(request, where),
      firstPage ? this.count(request, where) : Promise.resolve(null),
      firstPage && request.query.facets.length > 0
        ? this.facets(request, where)
        : Promise.resolve(null),
    ])
    const hasMore = hits.length > request.query.limit
    const page = hits.slice(0, request.query.limit)
    return {
      hits: page.map((row) => ({
        listingId: row.listing_id,
        sortKey: row.sort_key,
        score: row.score === null ? null : Number(row.score),
        distanceMeters: row.distance_m === null ? null : Number(row.distance_m),
      })),
      hasMore,
      total:
        total === null
          ? { value: null, strategy: "not_available" }
          : total > TOTAL_COUNT_CAP
            ? { value: TOTAL_COUNT_CAP, strategy: "estimated" }
            : { value: total, strategy: "exact" },
      facets,
    }
  }

  suggest(input: SuggestInput): Promise<Suggestion[]> {
    return this.suggestions.suggest(input)
  }

  async health(): Promise<DependencyCheck> {
    try {
      await this.db.client
        .$queryRaw`SELECT 1 FROM listing_search_documents LIMIT 1`
      return { status: "up" }
    } catch {
      return { status: "down", detail: "projection de recherche inaccessible" }
    }
  }

  private hits(request: ResolvedSearch, where: Prisma.Sql): Promise<HitRow[]> {
    const keyset = this.builder.keyset(request)
    const score =
      request.query.sort === "RELEVANCE"
        ? this.builder.score(request)
        : Prisma.sql`NULL::float8`
    const distance = this.builder.distance(request) ?? Prisma.sql`NULL::float8`
    return this.db.client.$queryRaw<HitRow[]>`
      SELECT l.public_id::text AS listing_id,
             ${this.builder.sortKey(request)} AS sort_key,
             ${score} AS score,
             ${distance} AS distance_m
      ${this.builder.from(request)}
      WHERE ${where} ${keyset ? Prisma.sql`AND ${keyset}` : Prisma.empty}
      ${this.builder.orderBy(request)}
      LIMIT ${request.query.limit + 1}
    `
  }

  /** Comptage plafonné : coût borné même sur une recherche très large. */
  private async count(
    request: ResolvedSearch,
    where: Prisma.Sql,
  ): Promise<number> {
    const rows = await this.db.client.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM (
        SELECT 1 ${this.builder.from(request)} WHERE ${where}
        LIMIT ${TOTAL_COUNT_CAP + 1}
      ) matched
    `
    return rows[0]?.n ?? 0
  }

  /**
   * Facettes sur les résultats de la recherche courante (échantillon plafonné),
   * en une requête. Villes et communes sont dérivées des quartiers ensuite.
   */
  private async facets(
    request: ResolvedSearch,
    where: Prisma.Sql,
  ): Promise<RawFacetCounts> {
    const wanted = new Set(request.query.facets)
    const parts: Prisma.Sql[] = []
    // Chaque branche porte ses alias : l'UNION prend les noms de la première.
    if (wanted.has("propertyTypes")) {
      parts.push(Prisma.sql`SELECT 'pt'::text AS f, pt.code::text AS k, count(*)::int AS n
        FROM m JOIN property_types pt ON pt.id = m.property_type_id GROUP BY pt.code`)
    }
    if (wanted.has("listingTypes")) {
      parts.push(Prisma.sql`SELECT 'lt'::text AS f, m.listing_type::text AS k, count(*)::int AS n
        FROM m GROUP BY m.listing_type`)
    }
    if (
      wanted.has("cities") ||
      wanted.has("communes") ||
      wanted.has("neighborhoods")
    ) {
      parts.push(Prisma.sql`SELECT 'ne'::text AS f, m.neighborhood_id::text AS k, count(*)::int AS n
        FROM m GROUP BY m.neighborhood_id`)
    }
    if (wanted.has("bedrooms")) {
      parts.push(Prisma.sql`SELECT 'be'::text AS f, LEAST(m.bedrooms, ${BEDROOMS_FACET_MAX}::int)::text AS k, count(*)::int AS n
        FROM m WHERE m.bedrooms IS NOT NULL GROUP BY 2`)
    }
    if (wanted.has("amenities")) {
      parts.push(Prisma.sql`SELECT 'am'::text AS f, a.code::text AS k, count(*)::int AS n FROM m
        JOIN property_amenities pa ON pa.property_id = m.property_id
        JOIN amenities a ON a.id = pa.amenity_id GROUP BY a.code`)
    }
    const bounds = this.config.priceFacetBounds
    if (wanted.has("priceRanges") && bounds.length > 0) {
      parts.push(Prisma.sql`SELECT 'pr'::text AS f, width_bucket(m.amount, ARRAY[${Prisma.join(bounds)}]::numeric[])::text AS k, count(*)::int AS n
        FROM m WHERE m.amount IS NOT NULL GROUP BY 2`)
    }
    if (parts.length === 0) return {}

    const rows = await this.db.client.$queryRaw<FacetRow[]>`
      WITH m AS (
        SELECT l.listing_type, p.id AS property_id, p.property_type_id,
               p.neighborhood_id, p.bedrooms, lp.amount
        ${this.builder.from(request)}
        WHERE ${where}
        LIMIT ${FACET_SAMPLE_CAP}
      )
      ${Prisma.join(parts, " UNION ALL ")}
    `
    const facets: RawFacetCounts = {}
    const byString = (key: "propertyTypes" | "listingTypes" | "amenities") =>
      (facets[key] ??= new Map<string, number>())
    const byNumber = (key: "neighborhoods" | "bedrooms") =>
      (facets[key] ??= new Map<number, number>())
    if (wanted.has("priceRanges") && bounds.length > 0) {
      facets.priceRanges = new Array<number>(bounds.length + 1).fill(0)
    }
    for (const row of rows) {
      switch (row.f) {
        case "pt":
          byString("propertyTypes").set(row.k, row.n)
          break
        case "lt":
          byString("listingTypes").set(row.k, row.n)
          break
        case "am":
          byString("amenities").set(row.k, row.n)
          break
        case "ne":
          byNumber("neighborhoods").set(Number(row.k), row.n)
          break
        case "be":
          byNumber("bedrooms").set(Number(row.k), row.n)
          break
        case "pr":
          if (facets.priceRanges) facets.priceRanges[Number(row.k)] = row.n
          break
      }
    }
    return facets
  }
}
