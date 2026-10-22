import { describe, expect, it } from "vitest"

import {
  buildListingSearchDocument,
  computeQualityScore,
  type ListingSearchSource,
} from "./listing-search-document"
import {
  canonicalSearch,
  SearchCacheKeyBuilder,
  searchFingerprint,
} from "./search-cache-key"
import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor"
import { parseSearchQuery, type RawSearchParams } from "./search-query"
import {
  activeWeights,
  combineScore,
  freshness,
  SEARCH_SCORE_WEIGHTS,
} from "./search-ranking"
import { RuleBasedRelaxationStrategy } from "./search-relaxation"
import {
  buildTsQuery,
  normalizeCode,
  normalizeText,
  parseSynonyms,
  tokenize,
} from "./text-normalizer"

const LIMITS = { defaultLimit: 20, maxLimit: 100, maxRadiusKm: 50 }
const parse = (params: RawSearchParams) => parseSearchQuery(params, LIMITS)
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return null
}

describe("normalisation du texte", () => {
  it("ignore la casse, les accents et les espaces superflus", () => {
    expect(normalizeText("  Rivière   ANGRÉ ")).toBe("riviere angre")
    expect(normalizeText("Rivière")).toBe(normalizeText("Riviere"))
  })

  it("retire les caractères de contrôle", () => {
    expect(normalizeText("villa\u0000\u0007cocody")).toBe("villa cocody")
  })

  it("ne garde que des mots [a-z0-9] d'au moins deux lettres", () => {
    expect(tokenize(normalizeText("Villa à Cocody !"))).toEqual([
      "villa",
      "cocody",
    ])
    expect(tokenize("'; drop table listings; --")).toEqual([
      "drop",
      "table",
      "listings",
    ])
    expect(tokenize("a & b | !c:*")).toEqual([])
  })

  it("normalise les codes de référentiel", () => {
    expect(normalizeCode("Port-Bouët")).toBe("PORT_BOUET")
    expect(normalizeCode(" cocody ")).toBe("COCODY")
    expect(normalizeCode("deux plateaux")).toBe("DEUX_PLATEAUX")
  })
})

describe("tsquery", () => {
  it("construit des préfixes reliés par ET", () => {
    expect(buildTsQuery(["villa", "cocody"], new Map())).toBe(
      "villa:* & cocody:*",
    )
  })

  it("étend les synonymes configurés en OU", () => {
    const synonyms = parseSynonyms("commerce=magasin|boutique;Bureau=office")
    expect(buildTsQuery(["commerce", "plateau"], synonyms)).toBe(
      "(commerce:* | magasin:* | boutique:*) & plateau:*",
    )
    expect(synonyms.get("bureau")).toEqual(["office"])
  })

  it("ignore les synonymes mal formés", () => {
    expect(parseSynonyms("=x;y=;;z").size).toBe(0)
  })

  it("ne contient jamais d'opérateur venu de l'utilisateur", () => {
    const tokens = tokenize(normalizeText("villa' | !(cocody) <-> x:*"))
    const query = buildTsQuery(tokens, new Map())!
    expect(query).toMatch(/^[a-z0-9]+:\*( & [a-z0-9]+:\*)*$/)
  })
})

describe("parseSearchQuery", () => {
  it("applique les valeurs par défaut documentées", () => {
    const query = parse({})
    expect(query.sort).toBe("NEWEST")
    expect(query.limit).toBe(20)
    expect(query.amenitiesMode).toBe("AND")
    expect(query.submit).toBe(false)
    expect(parse({ q: "villa" }).sort).toBe("RELEVANCE")
  })

  it("normalise les listes de codes", () => {
    const query = parse({
      commune: "Cocody, marcory,cocody",
      listingType: "rent,SALE",
    })
    expect(query.communes).toEqual(["COCODY", "MARCORY"])
    expect(query.listingTypes).toEqual(["RENT", "SALE"])
  })

  it("interprète bedrooms et bathrooms comme des minimums", () => {
    const query = parse({ bedrooms: "3", bathrooms: "2", maxBedrooms: "5" })
    expect(query.bedrooms).toEqual({ min: 3, max: 5 })
    expect(query.bathrooms).toEqual({ min: 2, max: null })
  })

  it("rejette les fourchettes incohérentes avec un code précis", () => {
    expect(code(() => parse({ minPrice: "500", maxPrice: "100" }))).toBe(
      "INVALID_PRICE_RANGE",
    )
    expect(code(() => parse({ minPrice: "-5" }))).toBe("INVALID_PRICE_RANGE")
    expect(code(() => parse({ maxPrice: "abc" }))).toBe("INVALID_PRICE_RANGE")
    expect(code(() => parse({ minSurface: "90", maxSurface: "10" }))).toBe(
      "INVALID_SURFACE_RANGE",
    )
    expect(code(() => parse({ minLandSurface: "1e9" }))).toBe(
      "INVALID_SURFACE_RANGE",
    )
  })

  it("valide la géolocalisation", () => {
    expect(code(() => parse({ lat: "95", lng: "0" }))).toBe(
      "INVALID_GEO_COORDINATES",
    )
    expect(code(() => parse({ lat: "5.3" }))).toBe("INVALID_GEO_COORDINATES")
    expect(code(() => parse({ lat: "5.3", lng: "abc" }))).toBe(
      "INVALID_GEO_COORDINATES",
    )
    expect(code(() => parse({ lat: "5.3", lng: "-4", radius: "0" }))).toBe(
      "INVALID_RADIUS",
    )
    expect(code(() => parse({ lat: "5.3", lng: "-4", radius: "51" }))).toBe(
      "INVALID_RADIUS",
    )
    expect(code(() => parse({ radius: "5" }))).toBe("INVALID_RADIUS")
    expect(parse({ lat: "5.3", lng: "-4" }).geo).toEqual({
      latitude: 5.3,
      longitude: -4,
      radiusKm: 10,
    })
  })

  it("exige des coordonnées pour le tri DISTANCE", () => {
    expect(code(() => parse({ sort: "DISTANCE" }))).toBe("INVALID_SEARCH_QUERY")
    expect(parse({ sort: "distance", lat: "5.3", lng: "-4" }).sort).toBe(
      "DISTANCE",
    )
  })

  it("plafonne la taille de page", () => {
    expect(code(() => parse({ limit: "101" }))).toBe("INVALID_SEARCH_QUERY")
    expect(code(() => parse({ limit: "100000" }))).toBe("INVALID_SEARCH_QUERY")
    expect(code(() => parse({ limit: "0" }))).toBe("INVALID_SEARCH_QUERY")
    expect(parse({ limit: "100" }).limit).toBe(100)
  })

  it("refuse les valeurs hors liste blanche", () => {
    expect(code(() => parse({ sort: "id; DROP TABLE" }))).toBe(
      "INVALID_SEARCH_QUERY",
    )
    expect(code(() => parse({ listingType: "GIFT" }))).toBe(
      "INVALID_SEARCH_QUERY",
    )
    expect(code(() => parse({ facets: "status" }))).toBe("INVALID_SEARCH_QUERY")
    expect(code(() => parse({ amenitiesMode: "XOR" }))).toBe(
      "INVALID_SEARCH_QUERY",
    )
    expect(code(() => parse({ submit: "yes" }))).toBe("INVALID_SEARCH_QUERY")
  })

  it("limite la longueur du texte et ignore un texte sans mot", () => {
    expect(code(() => parse({ q: "x".repeat(121) }))).toBe(
      "INVALID_SEARCH_QUERY",
    )
    expect(parse({ q: "!!! ???" }).text).toBeNull()
  })
})

describe("clé de cache", () => {
  it("est identique pour des URL équivalentes", () => {
    const a = parse({
      commune: "Cocody,Marcory",
      listingType: "rent",
      q: "Villa",
    })
    const b = parse({
      listingType: "RENT",
      commune: "marcory, cocody",
      q: "  villa ",
    })
    expect(canonicalSearch(a)).toBe(canonicalSearch(b))
    expect(SearchCacheKeyBuilder.results(a, 3, "postgres")).toBe(
      SearchCacheKeyBuilder.results(b, 3, "postgres"),
    )
  })

  it("change avec les filtres, la génération et le moteur", () => {
    const a = parse({ commune: "cocody" })
    const b = parse({ commune: "marcory" })
    expect(searchFingerprint(a)).not.toBe(searchFingerprint(b))
    expect(SearchCacheKeyBuilder.results(a, 1, "postgres")).not.toBe(
      SearchCacheKeyBuilder.results(a, 2, "postgres"),
    )
    expect(SearchCacheKeyBuilder.results(a, 1, "postgres")).not.toBe(
      SearchCacheKeyBuilder.results(a, 1, "opensearch"),
    )
  })

  it("ignore le curseur et submit", () => {
    expect(canonicalSearch(parse({ submit: "true" }))).toBe(
      canonicalSearch(parse({})),
    )
  })
})

describe("curseur", () => {
  const cursor = {
    sort: "PRICE_ASC" as const,
    key: "150000.00",
    id: "7d5c1f0e-4c1b-4c1e-9a43-2b8f0b1f0a11",
    asOf: new Date("2026-10-08T12:00:00.000Z"),
    hash: "abc123",
    fuzzy: false,
    engine: "postgres" as const,
  }

  it("fait l'aller-retour", () => {
    const raw = encodeSearchCursor(cursor)
    expect(
      decodeSearchCursor(raw, { sort: "PRICE_ASC", hash: "abc123" }),
    ).toEqual(cursor)
  })

  it("refuse un curseur d'une autre recherche ou d'un autre tri", () => {
    const raw = encodeSearchCursor(cursor)
    expect(
      code(() => decodeSearchCursor(raw, { sort: "NEWEST", hash: "abc123" })),
    ).toBe("INVALID_CURSOR")
    expect(
      code(() => decodeSearchCursor(raw, { sort: "PRICE_ASC", hash: "other" })),
    ).toBe("INVALID_CURSOR")
  })

  it("refuse un curseur malformé ou forgé", () => {
    const forge = (payload: object) =>
      Buffer.from(JSON.stringify(payload)).toString("base64url")
    const expected = { sort: "PRICE_ASC" as const, hash: "abc123" }
    expect(code(() => decodeSearchCursor("not a cursor!", expected))).toBe(
      "INVALID_CURSOR",
    )
    expect(code(() => decodeSearchCursor("e30", expected))).toBe(
      "INVALID_CURSOR",
    )
    expect(
      code(() =>
        decodeSearchCursor(
          forge({
            v: 1,
            s: "PRICE_ASC",
            k: "1); DROP TABLE listings; --",
            id: cursor.id,
            t: cursor.asOf.toISOString(),
            h: "abc123",
            f: 0,
            e: "pg",
          }),
          expected,
        ),
      ),
    ).toBe("INVALID_CURSOR")
    expect(
      code(() =>
        decodeSearchCursor(
          forge({
            v: 2,
            s: "PRICE_ASC",
            k: "1",
            id: cursor.id,
            t: cursor.asOf.toISOString(),
            h: "abc123",
            f: 0,
            e: "pg",
          }),
          expected,
        ),
      ),
    ).toBe("INVALID_CURSOR")
  })
})

describe("score de pertinence", () => {
  it("garde les poids centralisés", () => {
    expect(SEARCH_SCORE_WEIGHTS).toEqual({
      text: 0.5,
      location: 0.2,
      freshness: 0.15,
      quality: 0.15,
    })
  })

  it("renormalise les poids des composantes actives", () => {
    const all = activeWeights({ text: true, location: true })
    expect(all.text + all.location + all.freshness + all.quality).toBeCloseTo(1)
    const browse = activeWeights({ text: false, location: false })
    expect(browse.text).toBe(0)
    expect(browse.freshness).toBeCloseTo(0.5)
    expect(browse.quality).toBeCloseTo(0.5)
  })

  it("décroît avec l'âge et reste borné", () => {
    expect(freshness(0)).toBe(1)
    expect(freshness(30)).toBeCloseTo(0.5)
    expect(freshness(-5)).toBe(1)
    expect(
      combineScore(
        { text: 2, freshness: 1, quality: 1 },
        { text: true, location: false },
      ),
    ).toBeLessThanOrEqual(1)
  })
})

describe("relâchement des filtres", () => {
  it("propose des assouplissements sans rien exécuter", () => {
    const strategy = new RuleBasedRelaxationStrategy(50)
    const result = strategy.suggest(
      parse({
        q: "villa",
        commune: "cocody",
        neighborhood: "riviera",
        maxPrice: "100000",
        amenities: "PARKING",
        bedrooms: "3",
      }),
    )
    const filters = result.relaxedFilters.map((entry) => entry.filter)
    expect(filters).toEqual([
      "neighborhood",
      "maxPrice",
      "amenities",
      "bedrooms",
    ])
    expect(result.relaxedFilters[1]!.params.maxPrice).toBe("120000")
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it("élargit le rayon sans dépasser le maximum", () => {
    const strategy = new RuleBasedRelaxationStrategy(50)
    const near = strategy.suggest(
      parse({ lat: "5.3", lng: "-4", radius: "30" }),
    )
    expect(near.relaxedFilters[0]!.params.radius).toBe("50")
    expect(
      strategy.suggest(parse({ lat: "5.3", lng: "-4", radius: "50" }))
        .relaxedFilters,
    ).toEqual([])
  })
})

describe("document de recherche", () => {
  const source: ListingSearchSource = {
    listingId: "l-1",
    propertyId: "p-1",
    status: "PUBLISHED",
    listingType: "RENT",
    title: "Villa à Cocody",
    description: null,
    propertyDescription: "Belle villa ".repeat(30),
    propertyType: { code: "VILLA", name: "Villa" },
    city: { code: "ABIDJAN", name: "Abidjan" },
    commune: { code: "COCODY", name: "Cocody" },
    neighborhood: { id: 1, code: "RIVIERA", name: "Riviera" },
    publishedPoint: {
      latitude: 5.37,
      longitude: -3.96,
      precision: "APPROXIMATE",
    },
    price: { amount: 450000, currency: "XOF", period: "MONTH" },
    surface: 250,
    landSurface: null,
    bedrooms: 4,
    bathrooms: 3,
    amenities: [{ code: "PARKING", name: "Parking" }],
    mediaCount: 5,
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-02T00:00:00Z"),
  }

  it("est versionné et ne porte que la position publiée", () => {
    const document = buildListingSearchDocument(source)
    expect(document.schemaVersion).toBe(1)
    expect(document.location.point).toEqual({ lat: 5.37, lon: -3.96 })
    expect(document.location.precision).toBe("APPROXIMATE")
    expect(document.description).toBe(source.propertyDescription)
    expect(JSON.stringify(document)).not.toMatch(/address/i)
  })

  it("calcule un score de qualité entre 0 et 1", () => {
    const complete = computeQualityScore(source)
    expect(complete).toBeGreaterThan(0.8)
    expect(complete).toBeLessThanOrEqual(1)
    const empty = computeQualityScore({
      ...source,
      propertyDescription: null,
      mediaCount: 0,
      amenities: [],
      surface: null,
      publishedPoint: null,
    })
    expect(empty).toBe(0)
  })
})
