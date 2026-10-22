import { Injectable } from "@nestjs/common"
import type { SearchResponse, Suggestion } from "@mon-appart/types"

import { CacheService } from "../../../common/cache/cache.service"
import { MetricsService } from "../../../observability/metrics.service"
import { SearchCacheKeyBuilder } from "../domain/search-cache-key"
import type { SearchQuery } from "../domain/search-query"
import { SearchConfig } from "../search.config"

/** Au-delà, la réponse n'est pas mise en cache (mémoire Redis bornée). */
const MAX_CACHED_BYTES = 256 * 1024
/** Recherches à plus de mots : trop dispersées pour bénéficier du cache. */
const MAX_CACHED_TOKENS = 3

/**
 * Cache-aside Redis des recherches fréquentes : première page uniquement,
 * sans géolocalisation (coordonnées trop dispersées), TTL court. Invalidation
 * par génération : chaque événement d'annonce ou de bien incrémente le
 * compteur, les anciennes clés expirent d'elles-mêmes.
 */
@Injectable()
export class SearchCache {
  constructor(
    private readonly cache: CacheService,
    private readonly config: SearchConfig,
    private readonly metrics: MetricsService,
  ) {}

  isCacheable(query: SearchQuery): boolean {
    return (
      this.config.cacheTtlSeconds > 0 &&
      query.cursor === null &&
      query.geo === null &&
      (query.text?.tokens.length ?? 0) <= MAX_CACHED_TOKENS
    )
  }

  async getResults(
    query: SearchQuery,
    engine: string,
  ): Promise<SearchResponse | null> {
    const key = SearchCacheKeyBuilder.results(
      query,
      await this.generation(),
      engine,
    )
    const cached = await this.cache.get(key)
    if (cached === null) {
      this.metrics.search.cacheMisses.inc()
      return null
    }
    try {
      const response = JSON.parse(cached) as SearchResponse
      this.metrics.search.cacheHits.inc()
      return response
    } catch {
      this.metrics.search.cacheMisses.inc()
      return null
    }
  }

  async setResults(
    query: SearchQuery,
    engine: string,
    response: SearchResponse,
  ): Promise<void> {
    const payload = JSON.stringify(response)
    if (Buffer.byteLength(payload) > MAX_CACHED_BYTES) return
    const key = SearchCacheKeyBuilder.results(
      query,
      await this.generation(),
      engine,
    )
    await this.cache.set(key, payload, this.config.cacheTtlSeconds)
  }

  async getSuggestions(
    normalized: string,
    limit: number,
  ): Promise<Suggestion[] | null> {
    const key = SearchCacheKeyBuilder.suggestions(
      normalized,
      limit,
      await this.generation(),
    )
    const cached = await this.cache.get(key)
    if (cached === null) return null
    try {
      return JSON.parse(cached) as Suggestion[]
    } catch {
      return null
    }
  }

  async setSuggestions(
    normalized: string,
    limit: number,
    items: Suggestion[],
  ): Promise<void> {
    const key = SearchCacheKeyBuilder.suggestions(
      normalized,
      limit,
      await this.generation(),
    )
    await this.cache.set(
      key,
      JSON.stringify(items),
      this.config.cacheTtlSeconds,
    )
  }

  /** Rend inaccessibles toutes les entrées existantes. */
  async invalidate(): Promise<void> {
    await this.cache.incr(SearchCacheKeyBuilder.generation())
  }

  private async generation(): Promise<number> {
    const value = await this.cache.get(SearchCacheKeyBuilder.generation())
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }
}
