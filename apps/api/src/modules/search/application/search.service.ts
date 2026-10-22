import { Injectable, Logger } from "@nestjs/common"
import type { SEARCH_FILTERS } from "@mon-appart/analytics"
import type {
  SearchEngineName,
  SearchResponse,
  SuggestionResponse,
} from "@mon-appart/types"
import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"

import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { AppException } from "../../../common/http/app-exception"
import { MetricsService } from "../../../observability/metrics.service"
import { ActorService, type AuthenticatedUser } from "../../identity"
import { CatalogRepository } from "../../property"
import { searchFingerprint } from "../domain/search-cache-key"
import {
  decodeSearchCursor,
  encodeSearchCursor,
  type SearchCursor,
} from "../domain/search-cursor"
import type {
  EngineSearchResult,
  ResolvedSearch,
  SearchEngine,
} from "../domain/search-engine"
import { searchError, SearchErrorCode } from "../domain/search-errors"
import {
  hasStructuredFilters,
  parseSearchQuery,
  type RawSearchParams,
  type SearchQuery,
} from "../domain/search-query"
import {
  RuleBasedRelaxationStrategy,
  type SearchRelaxationStrategy,
} from "../domain/search-relaxation"
import { normalizeText } from "../domain/text-normalizer"
import { SearchHydrator } from "../infrastructure/postgres/search-hydrator"
import { SearchCache } from "../infrastructure/search-cache"
import { SearchEngineFactory } from "../infrastructure/search-engine.factory"
import { SearchConfig } from "../search.config"
import { labelFacets } from "./facet-labeler"
import { SearchHistoryService } from "./search-history.service"

export const SEARCH_PERFORMED_EVENT = "search.performed"

export const SUGGEST_MIN_LENGTH = 2
export const SUGGEST_MAX_LENGTH = 64
export const SUGGEST_MAX_LIMIT = 20
const SUGGEST_DEFAULT_LIMIT = 8

export interface SearchContext {
  user: AuthenticatedUser | undefined
  requestId: string | null
}

interface Execution {
  result: EngineSearchResult
  engine: SearchEngineName
  degraded: boolean
}

/**
 * Point d'entrée de la recherche publique. Les moteurs ne voient qu'une
 * requête validée et résolue ; les résultats sont toujours reconstruits
 * depuis PostgreSQL.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  private readonly relaxation: SearchRelaxationStrategy

  constructor(
    private readonly config: SearchConfig,
    private readonly engines: SearchEngineFactory,
    private readonly hydrator: SearchHydrator,
    private readonly catalog: CatalogRepository,
    private readonly cache: SearchCache,
    private readonly history: SearchHistoryService,
    private readonly actors: ActorService,
    private readonly events: DomainEventPublisher,
    private readonly metrics: MetricsService,
  ) {
    this.relaxation = new RuleBasedRelaxationStrategy(config.limits.maxRadiusKm)
  }

  async search(
    params: RawSearchParams,
    context: SearchContext,
  ): Promise<SearchResponse> {
    const started = performance.now()
    const query = parseSearchQuery(params, this.config.limits)
    const fingerprint = searchFingerprint(query).slice(0, 16)
    const cursor = query.cursor
      ? decodeSearchCursor(query.cursor, {
          sort: query.sort,
          hash: fingerprint,
        })
      : null
    const primary = this.engines.primary().name

    try {
      if (this.cache.isCacheable(query)) {
        const cached = await this.cache.getResults(query, primary)
        if (cached) {
          await this.afterSearch(query, null, cached, context, started, "hit")
          return cached
        }
      }

      const request = await this.resolve(query, cursor, fingerprint)
      let execution = await this.execute(request)
      // Plein texte strict vide : on retente une fois avec la tolérance aux fautes.
      if (
        !cursor &&
        query.text &&
        !request.fuzzy &&
        execution.result.hits.length === 0
      ) {
        request.fuzzy = true
        execution = await this.execute(request)
      }

      const response = await this.buildResponse(request, execution)
      if (this.cache.isCacheable(query) && !execution.degraded) {
        await this.cache.setResults(query, primary, response)
      }
      await this.afterSearch(query, request, response, context, started, "miss")
      return response
    } catch (error) {
      if (!(error instanceof AppException) || error.getStatus() >= 500) {
        const code =
          error instanceof AppException ? error.code : "INTERNAL_ERROR"
        this.metrics.search.errors.inc({ kind: "search", code })
      }
      throw error
    }
  }

  async suggest(
    rawQuery: string | undefined,
    rawLimit: string | undefined,
  ): Promise<SuggestionResponse> {
    const started = performance.now()
    const normalized = normalizeText(rawQuery ?? "")
    if (
      normalized.length < SUGGEST_MIN_LENGTH ||
      normalized.length > SUGGEST_MAX_LENGTH
    ) {
      throw searchError(
        SearchErrorCode.INVALID_SEARCH_QUERY,
        `q : entre ${SUGGEST_MIN_LENGTH} et ${SUGGEST_MAX_LENGTH} caractères`,
      )
    }
    let limit = SUGGEST_DEFAULT_LIMIT
    if (rawLimit !== undefined && rawLimit !== "") {
      limit = /^\d{1,2}$/.test(rawLimit) ? Number(rawLimit) : 0
      if (limit < 1 || limit > SUGGEST_MAX_LIMIT) {
        throw searchError(
          SearchErrorCode.INVALID_SEARCH_QUERY,
          `limit : entre 1 et ${SUGGEST_MAX_LIMIT}`,
        )
      }
    }
    const engine = this.engines.primary()
    let items = await this.cache.getSuggestions(normalized, limit)
    if (!items) {
      items = await engine.suggest({ normalized, limit })
      await this.cache.setSuggestions(normalized, limit, items)
    }
    this.metrics.search.requests.inc({ kind: "suggest", engine: engine.name })
    this.metrics.search.latency.observe(
      { kind: "suggest", engine: engine.name },
      performance.now() - started,
    )
    return { items }
  }

  /** Codes de référentiel → identifiants. Un code inconnu est une erreur explicite. */
  private async resolve(
    query: SearchQuery,
    cursor: SearchCursor | null,
    fingerprint: string,
  ): Promise<ResolvedSearch> {
    const unknown = (name: string) =>
      searchError(SearchErrorCode.INVALID_SEARCH_QUERY, `${name} inconnu`)

    const propertyTypeIds: number[] = []
    for (const code of query.propertyTypes) {
      const type = await this.catalog.propertyType(code)
      if (!type) throw unknown("propertyType")
      propertyTypeIds.push(type.id)
    }

    const amenities = await this.catalog.amenitiesByCodes(query.amenities)
    if (!amenities) throw unknown("amenities")

    let neighborhoodIds: number[] | null = null
    if (
      query.cities.length + query.communes.length + query.neighborhoods.length >
      0
    ) {
      const all = await this.catalog.neighborhoods()
      const check = (
        codes: string[],
        pick: (e: (typeof all)[number]) => string,
        name: string,
      ) => {
        for (const code of codes) {
          if (!all.some((entry) => pick(entry) === code)) throw unknown(name)
        }
      }
      check(query.cities, (entry) => entry.cityCode, "city")
      check(query.communes, (entry) => entry.communeCode, "commune")
      check(query.neighborhoods, (entry) => entry.code, "neighborhood")
      const within = (codes: string[], value: string) =>
        codes.length === 0 || codes.includes(value)
      neighborhoodIds = all
        .filter(
          (entry) =>
            within(query.cities, entry.cityCode) &&
            within(query.communes, entry.communeCode) &&
            within(query.neighborhoods, entry.code),
        )
        .map((entry) => entry.id)
    }

    return {
      query,
      cursor,
      asOf: cursor?.asOf ?? new Date(),
      fingerprint,
      neighborhoodIds,
      propertyTypeIds,
      amenityIds: amenities.map((amenity) => amenity.id),
      fuzzy: cursor?.fuzzy ?? false,
    }
  }

  /**
   * Moteur configuré, avec repli PostgreSQL contrôlé si OpenSearch échoue.
   * Un curseur reste lié au moteur qui l'a produit.
   */
  private async execute(request: ResolvedSearch): Promise<Execution> {
    const primary = this.engines.primary()
    const postgres = this.engines.postgres
    const cursorEngine = request.cursor?.engine
    if (primary.name === "postgres" || cursorEngine === "postgres") {
      return {
        result: await this.timed(postgres, request),
        engine: "postgres",
        degraded: primary.name !== "postgres",
      }
    }
    try {
      return {
        result: await this.timed(primary, request),
        engine: primary.name,
        degraded: false,
      }
    } catch (error) {
      this.metrics.search.opensearchErrors.inc({ operation: "search" })
      if (this.config.fallback === "none" || cursorEngine === "opensearch")
        throw error
      this.logger.warn(
        JSON.stringify({
          action: "search_fallback",
          from: primary.name,
          to: "postgres",
        }),
      )
      this.metrics.search.fallbacks.inc()
      return {
        result: await this.timed(postgres, request),
        engine: "postgres",
        degraded: true,
      }
    }
  }

  private async timed(engine: SearchEngine, request: ResolvedSearch) {
    const started = performance.now()
    try {
      return await engine.search(request)
    } finally {
      this.metrics.search.latency.observe(
        { kind: "search", engine: engine.name },
        performance.now() - started,
      )
    }
  }

  private async buildResponse(
    request: ResolvedSearch,
    execution: Execution,
  ): Promise<SearchResponse> {
    const { query } = request
    const { result } = execution
    const items = await this.hydrator.hydrate(result.hits, {
      withScore: query.sort === "RELEVANCE",
    })
    const last = result.hits[result.hits.length - 1]
    const nextCursor =
      result.hasMore && last
        ? encodeSearchCursor({
            sort: query.sort,
            key: last.sortKey,
            id: last.listingId,
            asOf: request.asOf,
            hash: request.fingerprint,
            fuzzy: request.fuzzy,
            engine: execution.engine,
          })
        : null

    const response: SearchResponse = {
      items,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null,
        limit: query.limit,
      },
      total: result.total,
      meta: {
        sort: query.sort,
        engine: execution.engine,
        degraded: execution.degraded,
        fuzzy: request.fuzzy,
      },
    }
    if (result.facets) {
      response.facets = labelFacets(
        result.facets,
        query.facets,
        await this.facetReferential(),
      )
    }
    if (request.cursor === null && items.length === 0) {
      response.zeroResults = this.relaxation.suggest(query)
    }
    return response
  }

  private async facetReferential() {
    const [types, amenities, neighborhoods] = await Promise.all([
      this.catalog.propertyTypes(),
      this.catalog.amenities(),
      this.catalog.neighborhoods(),
    ])
    return {
      propertyTypeNames: new Map(types.map((type) => [type.code, type.name])),
      amenityNames: new Map(
        amenities.map((amenity) => [amenity.code, amenity.name]),
      ),
      neighborhoods: new Map(neighborhoods.map((entry) => [entry.id, entry])),
      priceBounds: this.config.priceFacetBounds,
    }
  }

  /** Métriques, log structuré, historique (soumissions uniquement) et événement. */
  private async afterSearch(
    query: SearchQuery,
    request: ResolvedSearch | null,
    response: SearchResponse,
    context: SearchContext,
    started: number,
    cache: "hit" | "miss",
  ): Promise<void> {
    const engine = response.meta.engine
    this.metrics.search.requests.inc({ kind: "search", engine })
    if (response.items.length === 0 && query.cursor === null) {
      this.metrics.search.zeroResults.inc()
    }

    if (query.submit && query.cursor === null) {
      const actor = await this.actors.resolveOptional(context.user)
      const resolved =
        request ??
        (await this.resolve(query, null, searchFingerprint(query).slice(0, 16)))
      await this.history.record(
        resolved,
        actor?.userId ?? null,
        response.items.length,
      )
      this.events.publish({
        id: randomUUID(),
        name: SEARCH_PERFORMED_EVENT,
        occurredAt: new Date().toISOString(),
        aggregateId: "search",
        payload: {
          engine,
          sort: query.sort,
          hasText: query.text !== null,
          hasFilters: hasStructuredFilters(query),
          resultCount: response.total.value ?? response.items.length,
          userId: actor?.publicId ?? null,
          requestId: context.requestId,
          filters: activeFilters(query).map(([, code]) => code),
          listingType: single(query.listingTypes),
          propertyType: single(query.propertyTypes),
          commune: single(query.communes),
          priceMax: query.price.max,
        } satisfies SearchPerformedPayload,
      })
    }

    this.logger.log(
      JSON.stringify({
        action: "search",
        request_id: context.requestId ?? undefined,
        user_id: context.user?.id,
        query: query.text?.normalized.slice(0, 120),
        filters: activeFilters(query)
          .map(([name]) => name)
          .join(","),
        sort: query.sort,
        engine,
        degraded: response.meta.degraded,
        fuzzy: response.meta.fuzzy,
        cache,
        page: query.cursor === null ? 1 : "next",
        latency_ms: Math.round(performance.now() - started),
        result_count: response.items.length,
      }),
    )
  }
}

/**
 * Charge utile de `search.performed` : codes et bornes, jamais le texte saisi
 * ni les coordonnées. Les codes ne sont pas encore validés contre le référentiel.
 */
export interface SearchPerformedPayload {
  engine: SearchEngineName
  sort: SearchQuery["sort"]
  hasText: boolean
  hasFilters: boolean
  resultCount: number
  userId: string | null
  requestId: string | null
  filters: SearchFilterCode[]
  listingType: string | null
  propertyType: string | null
  commune: string | null
  priceMax: number | null
}

type SearchFilterCode = (typeof SEARCH_FILTERS)[number]

const ranged = (range: { min: number | null; max: number | null }) =>
  range.min !== null || range.max !== null

const FILTERS: ReadonlyArray<
  readonly [string, SearchFilterCode, (query: SearchQuery) => boolean]
> = [
  ["text", "TEXT", (query) => query.text !== null],
  ["listingType", "LISTING_TYPE", (query) => query.listingTypes.length > 0],
  ["propertyType", "PROPERTY_TYPE", (query) => query.propertyTypes.length > 0],
  ["city", "CITY", (query) => query.cities.length > 0],
  ["commune", "COMMUNE", (query) => query.communes.length > 0],
  ["neighborhood", "NEIGHBORHOOD", (query) => query.neighborhoods.length > 0],
  ["geo", "RADIUS", (query) => query.geo !== null],
  ["price", "PRICE", (query) => ranged(query.price)],
  ["surface", "SURFACE", (query) => ranged(query.surface)],
  ["landSurface", "LAND_SURFACE", (query) => ranged(query.landSurface)],
  ["bedrooms", "BEDROOMS", (query) => ranged(query.bedrooms)],
  ["bathrooms", "BATHROOMS", (query) => query.bathrooms.min !== null],
  ["amenities", "AMENITIES", (query) => query.amenities.length > 0],
]

/** Filtres actifs (jamais leurs valeurs, coordonnées comprises). */
function activeFilters(
  query: SearchQuery,
): Array<readonly [string, SearchFilterCode]> {
  return FILTERS.filter(([, , active]) => active(query)).map(
    ([name, code]) => [name, code] as const,
  )
}

function single<T>(values: readonly T[]): T | null {
  return values.length === 1 ? values[0]! : null
}
