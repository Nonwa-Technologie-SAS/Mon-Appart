import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { SearchEngineName } from "@mon-appart/types"

import type { SearchLimits } from "./domain/search-query"
import { parseSynonyms, type SynonymMap } from "./domain/text-normalizer"

/** Configuration Search, lue une fois depuis l'environnement validé. */
@Injectable()
export class SearchConfig {
  readonly engine: SearchEngineName
  readonly fallback: "postgres" | "none"
  readonly limits: SearchLimits
  readonly cacheTtlSeconds: number
  readonly reindexBatchSize: number
  readonly priceFacetBounds: number[]
  readonly synonyms: SynonymMap
  readonly indexVersion: number
  readonly opensearch: {
    node: string | null
    username: string | null
    password: string | null
    indexPrefix: string
    timeoutMs: number
    maxRetries: number
  }

  constructor(config: ConfigService) {
    const str = (key: string, fallback: string) => {
      const value = config.get<string | number>(key)
      return value === undefined || value === "" ? fallback : String(value)
    }
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    const optional = (key: string) => {
      const value = config.get<string>(key)
      return value === undefined || value === "" ? null : value
    }

    this.engine =
      str("SEARCH_ENGINE", "postgres") === "opensearch"
        ? "opensearch"
        : "postgres"
    this.fallback =
      str("SEARCH_FALLBACK", "postgres") === "none" ? "none" : "postgres"
    this.limits = {
      defaultLimit: num("SEARCH_DEFAULT_LIMIT", 20),
      maxLimit: Math.min(100, num("SEARCH_MAX_LIMIT", 100)),
      maxRadiusKm: num("SEARCH_MAX_RADIUS_KM", 50),
    }
    this.cacheTtlSeconds = num("SEARCH_CACHE_TTL_SECONDS", 60)
    this.reindexBatchSize = num("SEARCH_REINDEX_BATCH_SIZE", 500)
    this.priceFacetBounds = str(
      "SEARCH_PRICE_FACET_BOUNDS",
      "100000,250000,500000,1000000,5000000,50000000",
    )
      .split(",")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b)
    this.synonyms = parseSynonyms(str("SEARCH_SYNONYMS", ""))
    this.indexVersion = num("SEARCH_INDEX_VERSION", 1)
    this.opensearch = {
      node: optional("OPENSEARCH_NODE"),
      username: optional("OPENSEARCH_USERNAME"),
      password: optional("OPENSEARCH_PASSWORD"),
      indexPrefix: str("OPENSEARCH_INDEX_LISTINGS", "listings"),
      timeoutMs: num("OPENSEARCH_TIMEOUT_MS", 1_000),
      maxRetries: Math.min(2, num("OPENSEARCH_MAX_RETRIES", 1)),
    }
  }
}

/**
 * Limites par minute et par IP, lues au moment de la requête par le
 * ThrottlerGuard (l'environnement est validé au démarrage).
 */
export const searchRateLimit = (): number =>
  Number(process.env.SEARCH_RATE_LIMIT) || 60
export const suggestRateLimit = (): number =>
  Number(process.env.SEARCH_SUGGEST_RATE_LIMIT) || 240
