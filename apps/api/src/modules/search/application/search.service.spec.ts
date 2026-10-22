import type { ConfigService } from "@nestjs/config"
import { describe, expect, it, vi } from "vitest"

import type { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { MetricsService } from "../../../observability/metrics.service"
import type { ActorService } from "../../identity"
import type { CatalogRepository } from "../../property"
import { decodeSearchCursor } from "../domain/search-cursor"
import type { EngineSearchResult, SearchEngine } from "../domain/search-engine"
import { searchError, SearchErrorCode } from "../domain/search-errors"
import type { SearchHydrator } from "../infrastructure/postgres/search-hydrator"
import type { SearchCache } from "../infrastructure/search-cache"
import type { SearchEngineFactory } from "../infrastructure/search-engine.factory"
import type { SearchConfig } from "../search.config"
import type { SearchHistoryService } from "./search-history.service"
import { SearchService } from "./search.service"

const ID = "7d5c1f0e-4c1b-4c1e-9a43-2b8f0b1f0a11"

const page = (ids: string[], hasMore = false): EngineSearchResult => ({
  hits: ids.map((listingId) => ({
    listingId,
    sortKey: "1",
    score: 0.5,
    distanceMeters: null,
  })),
  hasMore,
  total: { value: ids.length, strategy: "exact" },
  facets: null,
})

function engine(
  name: "postgres" | "opensearch",
  search: SearchEngine["search"],
): SearchEngine {
  return {
    name,
    search: vi.fn(search),
    suggest: vi.fn().mockResolvedValue([]),
    health: vi.fn(),
  }
}

function service(options: {
  primary: SearchEngine
  postgres: SearchEngine
  fallback?: "postgres" | "none"
}) {
  const metrics = new MetricsService({
    get: () => "false",
  } as unknown as ConfigService)
  const config = {
    engine: options.primary.name,
    fallback: options.fallback ?? "postgres",
    limits: { defaultLimit: 20, maxLimit: 100, maxRadiusKm: 50 },
    priceFacetBounds: [],
  } as unknown as SearchConfig
  const engines = {
    primary: () => options.primary,
    postgres: options.postgres,
  } as unknown as SearchEngineFactory
  const hydrator = {
    hydrate: vi.fn(async (hits: Array<{ listingId: string }>) =>
      hits.map((hit) => ({ listingId: hit.listingId })),
    ),
  } as unknown as SearchHydrator
  const catalog = {
    propertyType: vi.fn(),
    amenitiesByCodes: vi.fn().mockResolvedValue([]),
    neighborhoods: vi.fn().mockResolvedValue([]),
  } as unknown as CatalogRepository
  const cache = {
    isCacheable: () => false,
    getSuggestions: vi.fn().mockResolvedValue(null),
    setSuggestions: vi.fn(),
  } as unknown as SearchCache
  const history = { record: vi.fn() } as unknown as SearchHistoryService
  const actors = {
    resolveOptional: vi.fn().mockResolvedValue(null),
  } as unknown as ActorService
  const events = { publish: vi.fn() } as unknown as DomainEventPublisher
  return {
    metrics,
    history,
    events,
    service: new SearchService(
      config,
      engines,
      hydrator,
      catalog,
      cache,
      history,
      actors,
      events,
      metrics,
    ),
  }
}

const context = { user: undefined, requestId: "req-1" }

describe("SearchService — moteur et repli", () => {
  it("utilise OpenSearch quand il répond", async () => {
    const primary = engine("opensearch", async () => page([ID]))
    const postgres = engine("postgres", async () => page([]))
    const { service: search } = service({ primary, postgres })
    const response = await search.search({ commune: undefined }, context)
    expect(response.meta).toMatchObject({
      engine: "opensearch",
      degraded: false,
    })
    expect(postgres.search).not.toHaveBeenCalled()
  })

  it("se replie sur PostgreSQL, signale le mode dégradé et le mesure", async () => {
    const primary = engine("opensearch", async () => {
      throw searchError(SearchErrorCode.SEARCH_TIMEOUT)
    })
    const postgres = engine("postgres", async () => page([ID], true))
    const { service: search, metrics } = service({ primary, postgres })
    const response = await search.search({}, context)
    expect(response.meta).toMatchObject({ engine: "postgres", degraded: true })
    expect(response.items).toHaveLength(1)
    expect((await metrics.search.fallbacks.get()).values[0]?.value).toBe(1)
    // Le curseur suivant reste lié à PostgreSQL.
    const payload = JSON.parse(
      Buffer.from(response.pagination.nextCursor!, "base64url").toString(
        "utf8",
      ),
    ) as { h: string }
    const cursor = decodeSearchCursor(response.pagination.nextCursor!, {
      sort: "NEWEST",
      hash: payload.h,
    })
    expect(cursor.engine).toBe("postgres")
  })

  it("renvoie 503 sans repli quand SEARCH_FALLBACK=none", async () => {
    const primary = engine("opensearch", async () => {
      throw searchError(SearchErrorCode.SEARCH_ENGINE_UNAVAILABLE)
    })
    const postgres = engine("postgres", async () => page([]))
    const { service: search } = service({ primary, postgres, fallback: "none" })
    await expect(search.search({}, context)).rejects.toMatchObject({
      code: "SEARCH_ENGINE_UNAVAILABLE",
    })
    expect(postgres.search).not.toHaveBeenCalled()
  })

  it("retente en mode tolérant aux fautes quand le plein texte strict est vide", async () => {
    const postgres = engine("postgres", async (request) =>
      request.fuzzy ? page([ID]) : page([]),
    )
    const { service: search } = service({ primary: postgres, postgres })
    const response = await search.search({ q: "vila cocodi" }, context)
    expect(response.meta.fuzzy).toBe(true)
    expect(postgres.search).toHaveBeenCalledTimes(2)
  })

  it("propose des assouplissements quand rien ne correspond", async () => {
    const postgres = engine("postgres", async () => page([]))
    const { service: search } = service({ primary: postgres, postgres })
    const response = await search.search({ maxPrice: "100000" }, context)
    expect(response.items).toEqual([])
    expect(response.zeroResults?.relaxedFilters[0]?.filter).toBe("maxPrice")
  })

  it("n'historise que les recherches soumises, sans texte dans l'événement", async () => {
    const postgres = engine("postgres", async () => page([ID]))
    const {
      service: search,
      history,
      events,
    } = service({ primary: postgres, postgres })
    await search.search({ q: "villa" }, context)
    expect(history.record).not.toHaveBeenCalled()
    await search.search({ q: "villa", submit: "true" }, context)
    expect(history.record).toHaveBeenCalledTimes(1)
    const published = vi.mocked(events.publish).mock.calls[0]![0]
    expect(published.name).toBe("search.performed")
    expect(JSON.stringify(published.payload)).not.toContain("villa")
  })

  it("valide la saisie des suggestions", async () => {
    const postgres = engine("postgres", async () => page([]))
    const { service: search } = service({ primary: postgres, postgres })
    await expect(search.suggest("a", undefined)).rejects.toMatchObject({
      code: "INVALID_SEARCH_QUERY",
    })
    await expect(search.suggest("coc", "50")).rejects.toMatchObject({
      code: "INVALID_SEARCH_QUERY",
    })
    await expect(search.suggest("coc", "5")).resolves.toEqual({ items: [] })
  })
})
