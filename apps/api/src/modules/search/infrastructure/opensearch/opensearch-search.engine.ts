import { Logger } from "@nestjs/common"
import type { DependencyCheck, Suggestion } from "@mon-appart/types"

import { safeErrorMessage } from "../../../../common/http/safe-error"
import { searchError, SearchErrorCode } from "../../domain/search-errors"
import {
  TOTAL_COUNT_CAP,
  type EngineSearchResult,
  type RawFacetCounts,
  type ResolvedSearch,
  type SearchEngine,
  type SuggestInput,
} from "../../domain/search-engine"
import type { SuggestionProvider } from "../suggestion.provider"
import { BEDROOMS_FACET_MAX } from "../postgres/postgres-search.engine"
import { isTimeoutError, type OpenSearchGateway } from "./opensearch.gateway"
import { buildOpenSearchQuery } from "./opensearch-query.builder"

interface Bucket {
  key: string | number
  doc_count: number
}

/**
 * Moteur OpenSearch : renvoie des identifiants candidats ; les résultats sont
 * ensuite relus et filtrés dans PostgreSQL. Toute erreur devient
 * SEARCH_TIMEOUT ou SEARCH_ENGINE_UNAVAILABLE, ce qui déclenche le repli.
 */
export class OpenSearchEngine implements SearchEngine {
  readonly name = "opensearch" as const
  private readonly logger = new Logger(OpenSearchEngine.name)

  constructor(
    private readonly gateway: OpenSearchGateway,
    private readonly alias: string,
    private readonly priceBounds: readonly number[],
    private readonly suggestions: SuggestionProvider,
  ) {}

  async search(request: ResolvedSearch): Promise<EngineSearchResult> {
    if (request.neighborhoodIds?.length === 0) {
      return {
        hits: [],
        hasMore: false,
        total: { value: 0, strategy: "exact" },
        facets: request.query.facets.length > 0 ? {} : null,
      }
    }
    const body = buildOpenSearchQuery(request, this.priceBounds)
    let response
    try {
      response = await this.gateway.search(this.alias, body)
    } catch (error) {
      const timeout = isTimeoutError(error)
      this.logger.warn(
        `OpenSearch ${timeout ? "timeout" : "erreur"} : ${safeErrorMessage(error)}`,
      )
      throw searchError(
        timeout
          ? SearchErrorCode.SEARCH_TIMEOUT
          : SearchErrorCode.SEARCH_ENGINE_UNAVAILABLE,
      )
    }
    const limit = request.query.limit
    const hits = response.hits.hits
    const total = response.hits.total
    return {
      hits: hits.slice(0, limit).map((hit) => ({
        listingId: hit._id,
        sortKey:
          hit.sort?.[0] === undefined || hit.sort[0] === null
            ? null
            : String(hit.sort[0]),
        score: request.query.sort === "RELEVANCE" ? (hit._score ?? null) : null,
        distanceMeters:
          request.query.sort === "DISTANCE" && typeof hit.sort?.[0] === "number"
            ? hit.sort[0]
            : null,
      })),
      hasMore: hits.length > limit,
      total:
        request.cursor !== null || !total
          ? { value: null, strategy: "not_available" }
          : total.value > TOTAL_COUNT_CAP || total.relation === "gte"
            ? {
                value: Math.min(total.value, TOTAL_COUNT_CAP),
                strategy: "estimated",
              }
            : { value: total.value, strategy: "exact" },
      facets: this.facets(response.aggregations),
    }
  }

  suggest(input: SuggestInput): Promise<Suggestion[]> {
    return this.suggestions.suggest(input)
  }

  async health(): Promise<DependencyCheck> {
    try {
      const status = await this.gateway.clusterHealth()
      return status === "red"
        ? { status: "down", detail: "cluster red" }
        : { status: "up", detail: `cluster ${status}` }
    } catch {
      return { status: "down", detail: "injoignable" }
    }
  }

  private facets(
    aggregations: Record<string, unknown> | undefined,
  ): RawFacetCounts | null {
    const sample = aggregations?.sample as
      Record<string, { buckets?: Bucket[] }> | undefined
    if (!sample) return null
    const buckets = (name: string) => sample[name]?.buckets
    const facets: RawFacetCounts = {}
    const toStringMap = (list: Bucket[]) =>
      new Map(list.map((bucket) => [String(bucket.key), bucket.doc_count]))
    const propertyTypes = buckets("propertyTypes")
    if (propertyTypes) facets.propertyTypes = toStringMap(propertyTypes)
    const listingTypes = buckets("listingTypes")
    if (listingTypes) facets.listingTypes = toStringMap(listingTypes)
    const amenities = buckets("amenities")
    if (amenities) facets.amenities = toStringMap(amenities)
    const neighborhoods = buckets("neighborhoods")
    if (neighborhoods) {
      facets.neighborhoods = new Map(
        neighborhoods.map((bucket) => [Number(bucket.key), bucket.doc_count]),
      )
    }
    const bedrooms = buckets("bedrooms")
    if (bedrooms) {
      const map = new Map<number, number>()
      for (const bucket of bedrooms) {
        const key = Math.min(Number(bucket.key), BEDROOMS_FACET_MAX)
        map.set(key, (map.get(key) ?? 0) + bucket.doc_count)
      }
      facets.bedrooms = map
    }
    const prices = buckets("priceRanges")
    if (prices) facets.priceRanges = prices.map((bucket) => bucket.doc_count)
    return facets
  }
}
