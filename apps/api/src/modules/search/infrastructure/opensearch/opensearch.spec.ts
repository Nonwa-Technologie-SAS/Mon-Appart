import { describe, expect, it, vi } from "vitest"

import {
  buildListingSearchDocument,
  type ListingSearchSource,
} from "../../domain/listing-search-document"
import type { ResolvedSearch } from "../../domain/search-engine"
import {
  parseSearchQuery,
  type RawSearchParams,
} from "../../domain/search-query"
import { parseSynonyms } from "../../domain/text-normalizer"
import type { SuggestionProvider } from "../suggestion.provider"
import type { OpenSearchGateway } from "./opensearch.gateway"
import { OpenSearchIndexStore } from "./opensearch-index.store"
import { listingIndexDefinition } from "./opensearch-mapping"
import { buildOpenSearchQuery } from "./opensearch-query.builder"
import { OpenSearchEngine } from "./opensearch-search.engine"

// Ces tests vérifient la traduction et le contrat avec un client simulé ;
// ils ne prétendent pas tester un vrai cluster OpenSearch.

const LIMITS = { defaultLimit: 20, maxLimit: 100, maxRadiusKm: 50 }

function resolved(
  params: RawSearchParams,
  overrides: Partial<ResolvedSearch> = {},
): ResolvedSearch {
  return {
    query: parseSearchQuery(params, LIMITS),
    cursor: null,
    asOf: new Date("2026-10-08T00:00:00Z"),
    fingerprint: "f",
    neighborhoodIds: null,
    propertyTypeIds: [],
    amenityIds: [],
    fuzzy: false,
    ...overrides,
  }
}

function gateway(
  overrides: Partial<OpenSearchGateway> = {},
): OpenSearchGateway {
  return {
    search: vi.fn(),
    bulk: vi.fn().mockResolvedValue({ failed: 0 }),
    indexExists: vi.fn().mockResolvedValue(false),
    createIndex: vi.fn().mockResolvedValue(undefined),
    aliasTargets: vi.fn().mockResolvedValue([]),
    swapAlias: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    clusterHealth: vi.fn().mockResolvedValue("green"),
    ...overrides,
  }
}

const suggestions = {
  suggest: vi.fn().mockResolvedValue([]),
} as unknown as SuggestionProvider

describe("buildOpenSearchQuery", () => {
  it("ne cherche que les annonces publiées et applique les filtres", () => {
    const body = buildOpenSearchQuery(
      resolved(
        {
          listingType: "RENT",
          propertyType: "VILLA",
          minPrice: "100000",
          bedrooms: "3",
          amenities: "PARKING,SECURITY",
        },
        { neighborhoodIds: [4, 5] },
      ),
      [100000],
    ) as { query: { bool: { filter: unknown[] } } }
    const filters = JSON.stringify(body.query.bool.filter)
    expect(filters).toContain('{"term":{"status":"PUBLISHED"}}')
    expect(filters).toContain('{"terms":{"listingType":["RENT"]}}')
    expect(filters).toContain('{"terms":{"location.neighborhoodId":[4,5]}}')
    expect(filters).toContain('{"range":{"price.amount":{"gte":100000}}}')
    expect(filters).toContain('{"range":{"bedrooms":{"gte":3}}}')
    expect(filters).toContain('{"term":{"amenities.code":"PARKING"}}')
    expect(filters).toContain('{"term":{"amenities.code":"SECURITY"}}')
  })

  it("n'insère le texte utilisateur que comme valeur de multi_match", () => {
    const body = buildOpenSearchQuery(
      resolved({ q: 'villa"},"script":{"source":"x' }),
      [],
    )
    const json = JSON.stringify(body)
    expect(json).not.toContain('"script":{')
    expect(json).toContain('"query":"villa script source"')
  })

  it("trie de façon stable et pagine par search_after", () => {
    const request = resolved(
      { sort: "PRICE_ASC" },
      {
        cursor: {
          sort: "PRICE_ASC",
          key: "150000",
          id: "7d5c1f0e-4c1b-4c1e-9a43-2b8f0b1f0a11",
          asOf: new Date(),
          hash: "f",
          fuzzy: false,
          engine: "opensearch",
        },
      },
    )
    const body = buildOpenSearchQuery(request, []) as Record<string, unknown>
    expect(body.sort).toEqual([
      { "price.amount": { order: "asc", missing: "_last" } },
      { listingId: { order: "asc" } },
    ])
    expect(body.search_after).toEqual([
      150000,
      "7d5c1f0e-4c1b-4c1e-9a43-2b8f0b1f0a11",
    ])
    expect(body.track_total_hits).toBe(false)
    expect(body.aggs).toBeUndefined()
  })

  it("filtre par rayon sur la position publiée et demande les facettes", () => {
    const body = buildOpenSearchQuery(
      resolved({
        lat: "5.36",
        lng: "-3.98",
        radius: "5",
        facets: "communes,priceRanges",
      }),
      [100000, 500000],
    ) as { aggs: { sample: { aggs: Record<string, unknown> } }; query: unknown }
    expect(JSON.stringify(body.query)).toContain(
      '"geo_distance":{"distance":"5km"',
    )
    expect(Object.keys(body.aggs.sample.aggs)).toEqual([
      "neighborhoods",
      "priceRanges",
    ])
  })
})

describe("OpenSearchEngine", () => {
  it("renvoie des identifiants, une pagination et un total plafonné", async () => {
    const search = vi.fn().mockResolvedValue({
      hits: {
        total: { value: 5000, relation: "gte" },
        hits: [
          { _id: "a", _score: 1.5, sort: [1.5, "a"] },
          { _id: "b", _score: 1.2, sort: [1.2, "b"] },
          { _id: "c", _score: 1.0, sort: [1.0, "c"] },
        ],
      },
    })
    const engine = new OpenSearchEngine(
      gateway({ search }),
      "listings_current",
      [],
      suggestions,
    )
    const result = await engine.search(resolved({ q: "villa", limit: "2" }))
    expect(search).toHaveBeenCalledWith("listings_current", expect.any(Object))
    expect(result.hits.map((hit) => hit.listingId)).toEqual(["a", "b"])
    expect(result.hits[1]!.sortKey).toBe("1.2")
    expect(result.hasMore).toBe(true)
    expect(result.total).toEqual({ value: 1000, strategy: "estimated" })
  })

  it("traduit un délai dépassé en SEARCH_TIMEOUT et une panne en SEARCH_ENGINE_UNAVAILABLE", async () => {
    const timeout = Object.assign(new Error("Request timed out"), {
      name: "TimeoutError",
    })
    const slow = new OpenSearchEngine(
      gateway({ search: vi.fn().mockRejectedValue(timeout) }),
      "x",
      [],
      suggestions,
    )
    await expect(slow.search(resolved({}))).rejects.toMatchObject({
      code: "SEARCH_TIMEOUT",
    })
    const down = new OpenSearchEngine(
      gateway({
        search: vi
          .fn()
          .mockRejectedValue(
            new Error("connect ECONNREFUSED https://user:secret@os:9200"),
          ),
      }),
      "x",
      [],
      suggestions,
    )
    const error = (await down.search(resolved({})).then(
      () => null,
      (e: unknown) => e,
    )) as { code: string; message: string }
    expect(error.code).toBe("SEARCH_ENGINE_UNAVAILABLE")
    expect(error.message).not.toContain("secret")
  })

  it("rend les facettes brutes depuis les agrégations", async () => {
    const engine = new OpenSearchEngine(
      gateway({
        search: vi.fn().mockResolvedValue({
          hits: { hits: [] },
          aggregations: {
            sample: {
              bedrooms: {
                buckets: [
                  { key: 2, doc_count: 3 },
                  { key: 6, doc_count: 1 },
                  { key: 7, doc_count: 2 },
                ],
              },
              neighborhoods: { buckets: [{ key: 4, doc_count: 2 }] },
              priceRanges: { buckets: [{ doc_count: 1 }, { doc_count: 4 }] },
            },
          },
        }),
      }),
      "x",
      [100000],
      suggestions,
    )
    const result = await engine.search(
      resolved({ facets: "bedrooms,communes,priceRanges" }),
    )
    expect(result.facets?.bedrooms).toEqual(
      new Map([
        [2, 3],
        [5, 3],
      ]),
    )
    expect(result.facets?.neighborhoods).toEqual(new Map([[4, 2]]))
    expect(result.facets?.priceRanges).toEqual([1, 4])
  })

  it("signale un cluster rouge ou injoignable", async () => {
    const red = new OpenSearchEngine(
      gateway({ clusterHealth: vi.fn().mockResolvedValue("red") }),
      "x",
      [],
      suggestions,
    )
    expect((await red.health()).status).toBe("down")
    const lost = new OpenSearchEngine(
      gateway({ clusterHealth: vi.fn().mockRejectedValue(new Error("x")) }),
      "x",
      [],
      suggestions,
    )
    expect((await lost.health()).status).toBe("down")
  })
})

describe("OpenSearchIndexStore", () => {
  const source = {
    listingId: "l-1",
    propertyId: "p-1",
    status: "PUBLISHED",
    listingType: "SALE",
    title: "Terrain",
    description: null,
    propertyDescription: null,
    propertyType: { code: "LAND", name: "Terrain" },
    city: { code: "ABIDJAN", name: "Abidjan" },
    commune: { code: "BINGERVILLE", name: "Bingerville" },
    neighborhood: { id: 9, code: "FEH_KESSE", name: "Féh Kessé" },
    publishedPoint: null,
    price: null,
    surface: null,
    landSurface: 600,
    bedrooms: null,
    bathrooms: null,
    amenities: [],
    mediaCount: 0,
    publishedAt: null,
    updatedAt: new Date(),
  } satisfies ListingSearchSource

  it("crée l'index et l'alias avant la première écriture, une seule fois", async () => {
    const gw = gateway()
    const store = new OpenSearchIndexStore(gw, "listings", 1, new Map())
    const document = buildListingSearchDocument(source)
    await store.index(document)
    await store.delete("l-1")
    expect(gw.createIndex).toHaveBeenCalledTimes(1)
    expect(gw.createIndex).toHaveBeenCalledWith(
      "listings_v1",
      expect.any(Object),
    )
    expect(gw.swapAlias).toHaveBeenCalledWith(
      "listings_current",
      [],
      "listings_v1",
    )
    expect(gw.bulk).toHaveBeenNthCalledWith(1, "listings_current", [
      expect.objectContaining({
        action: "index",
        id: "l-1",
        document: expect.objectContaining({ surfaceOrLand: 600 }),
      }),
    ])
    expect(gw.bulk).toHaveBeenNthCalledWith(2, "listings_current", [
      { action: "delete", id: "l-1" },
    ])
  })

  it("bascule l'alias vers un nouvel index versionné", async () => {
    const gw = gateway({
      aliasTargets: vi.fn().mockResolvedValue(["listings_v1"]),
    })
    const store = new OpenSearchIndexStore(gw, "listings", 2, new Map())
    const index = await store.createVersionedIndex(
      new Date("2026-10-08T21:30:15Z"),
    )
    expect(index).toBe("listings_v2_20261008213015")
    expect(await store.activate(index)).toEqual(["listings_v1"])
    expect(gw.swapAlias).toHaveBeenCalledWith(
      "listings_current",
      ["listings_v1"],
      index,
    )
  })

  it("lève une erreur si l'indexation est refusée", async () => {
    const store = new OpenSearchIndexStore(
      gateway({
        aliasTargets: vi.fn().mockResolvedValue(["listings_v1"]),
        bulk: vi.fn().mockResolvedValue({ failed: 1 }),
      }),
      "listings",
      1,
      new Map(),
    )
    await expect(
      store.index(buildListingSearchDocument(source)),
    ).rejects.toThrow()
  })
})

describe("mapping", () => {
  it("est strict, géolocalisé et intègre les synonymes configurés", () => {
    const definition = listingIndexDefinition(
      parseSynonyms("commerce=magasin"),
    ) as {
      settings: {
        analysis: {
          filter: Record<string, unknown>
          analyzer: { mon_appart_french: { filter: string[] } }
        }
      }
      mappings: {
        dynamic: string
        properties: Record<
          string,
          { properties?: Record<string, { type: string }> }
        >
      }
    }
    expect(definition.mappings.dynamic).toBe("strict")
    expect(
      definition.mappings.properties.location!.properties!.point!.type,
    ).toBe("geo_point")
    expect(
      definition.settings.analysis.analyzer.mon_appart_french.filter,
    ).toContain("asciifolding")
    expect(definition.settings.analysis.filter.mon_appart_synonyms).toEqual({
      type: "synonym_graph",
      synonyms: ["commerce, magasin"],
    })
  })
})
