import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  parseApiEnv,
  parseRecommendationWeights,
} from "@mon-appart/config"
import { describe, expect, it } from "vitest"

import { TEST_SECRETS } from "../../identity/testing/identity-test-kit"
import {
  buildBehaviorProfile,
  parseBehaviorSignals,
  type BehaviorSignal,
} from "./behavior-profile"
import {
  budgetCeiling,
  deducePeriod,
  scoreBudget,
  scorePriceCloseness,
  type Budget,
} from "./budget"
import { diversify, listingSimilarity } from "./diversification"
import {
  decodeRecommendationCursor,
  encodeRecommendationCursor,
  fingerprint,
} from "./recommendation-cursor"
import { rankWithRules } from "./recommendation-engine"
import {
  recommendationLevel,
  type DeclaredPreferences,
  type ListingCandidate,
  type ScoringContext,
} from "./recommendation-input"
import { scoreCandidate, VIEWED_PENALTY } from "./scoring"

const AS_OF = new Date("2026-10-09T12:00:00Z")
const DAY = 86_400_000
const WEIGHTS = parseRecommendationWeights(DEFAULT_RECOMMENDATION_WEIGHTS)

let sequence = 0
function candidate(
  overrides: Partial<ListingCandidate> = {},
): ListingCandidate {
  sequence += 1
  return {
    listingId: BigInt(sequence),
    publicId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    propertyId: BigInt(1000 + sequence),
    createdById: BigInt(500 + sequence),
    listingType: "RENT",
    propertyTypeId: 1,
    propertyTypeCode: "APARTMENT",
    propertyCategory: "RESIDENTIAL",
    neighborhoodId: 10,
    communeId: 100,
    cityId: 1000,
    price: { amount: 200_000, currency: "XOF", period: "MONTH" },
    surface: 80,
    landSurface: null,
    bedrooms: 2,
    bathrooms: 1,
    publishedAt: new Date(AS_OF.getTime() - 3 * DAY),
    qualityScore: 0.9,
    distanceMeters: null,
    amenityCodes: ["PARKING"],
    recentViews: 0,
    ...overrides,
  }
}

function preferences(
  overrides: Partial<DeclaredPreferences> = {},
): DeclaredPreferences {
  return {
    listingTypes: ["RENT"],
    budget: null,
    propertyTypeIds: [],
    propertyCategories: [],
    neighborhoodIds: [],
    communeIds: [],
    nearbyCommuneIds: [],
    cityIds: [],
    amenityCodes: [],
    bedrooms: null,
    bathrooms: null,
    surface: { min: null, max: null },
    point: null,
    ...overrides,
  }
}

function context(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    mode: "PERSONALIZED",
    weights: WEIGHTS,
    preferences: null,
    behavior: null,
    reference: null,
    viewedPropertyIds: new Set(),
    asOf: AS_OF,
    ...overrides,
  }
}

const budget = (overrides: Partial<Budget> = {}): Budget => ({
  min: null,
  max: 250_000,
  currency: "XOF",
  period: "MONTH",
  tolerancePct: 0,
  ...overrides,
})

const price = (
  amount: number,
  period: "MONTH" | "TOTAL" = "MONTH",
  currency = "XOF",
) => ({
  amount,
  currency,
  period,
})

describe("configuration des poids", () => {
  it("lit les poids par défaut (somme 100)", () => {
    expect(WEIGHTS).toEqual({
      budget: 30,
      location: 20,
      type: 15,
      size: 10,
      amenities: 10,
      behavior: 10,
      quality: 5,
    })
  })

  it.each([
    [
      "budget:30,location:20,type:15,size:10,amenities:10,behavior:10,quality:6",
      /100/,
    ],
    ["budget:30,location:20", /manquantes/],
    [
      "budget:30,budget:20,type:15,size:10,amenities:10,behavior:10,quality:5",
      /répétée/,
    ],
    [
      "budget:x,location:20,type:15,size:10,amenities:10,behavior:10,quality:5",
      /invalide/,
    ],
    [
      "price:30,location:20,type:15,size:10,amenities:10,behavior:10,quality:5",
      /inconnue/,
    ],
  ])("rejette %s", (value, error) => {
    expect(() => parseRecommendationWeights(value)).toThrow(error)
  })

  it("refuse au démarrage des poids invalides ou un moteur distant sans URL", () => {
    const base = { APP_ENV: "test", ...TEST_SECRETS }
    expect(parseApiEnv(base).RECOMMENDATION_ENGINE).toBe("rules")
    expect(
      parseApiEnv({
        ...base,
        RECOMMENDATION_ENGINE: "remote",
        RECOMMENDATION_SERVICE_URL: "http://localhost:8000",
      }).RECOMMENDATION_ENGINE,
    ).toBe("remote")
    expect(() =>
      parseApiEnv({ ...base, RECOMMENDATION_WEIGHTS: "budget:100" }),
    ).toThrow()
    expect(() =>
      parseApiEnv({ ...base, RECOMMENDATION_ENGINE: "remote" }),
    ).toThrow()
    expect(() =>
      parseApiEnv({
        ...base,
        RECOMMENDATION_DEFAULT_LIMIT: "40",
        RECOMMENDATION_MAX_LIMIT: "30",
      }),
    ).toThrow()
  })
})

describe("budget", () => {
  it("déduit la périodicité seulement si elle est univoque", () => {
    expect(deducePeriod(["RENT"])).toBe("MONTH")
    expect(deducePeriod(["SALE", "LEASE_TO_OWN"])).toBe("TOTAL")
    expect(deducePeriod(["RENT", "SALE"])).toBeNull()
    expect(deducePeriod([])).toBeNull()
  })

  it("ne compare jamais deux devises ou deux périodicités", () => {
    expect(scoreBudget(price(100_000, "TOTAL"), budget())).toBeNull()
    expect(scoreBudget(price(100_000, "MONTH", "EUR"), budget())).toBeNull()
  })

  it("traite le maximum comme strict sans tolérance", () => {
    expect(budgetCeiling(budget())).toBe(250_000)
    expect(scoreBudget(price(250_000), budget())?.score).toBeCloseTo(0.7)
    expect(scoreBudget(price(250_001), budget())).toBeNull()
  })

  it("applique la tolérance explicite sans modifier le budget", () => {
    const declared = budget({ tolerancePct: 10 })
    expect(budgetCeiling(declared)).toBeCloseTo(275_000)
    const over = scoreBudget(price(262_500), declared)
    expect(over?.fit).toBe("WITHIN_TOLERANCE")
    expect(over!.score).toBeCloseTo(0.45)
    expect(scoreBudget(price(276_000), declared)).toBeNull()
    expect(declared.max).toBe(250_000)
  })

  it("favorise une marge confortable et ne pénalise que modérément un prix bas", () => {
    expect(scoreBudget(price(200_000), budget())?.score).toBe(1)
    expect(scoreBudget(price(230_000), budget())!.score).toBeLessThan(1)
    expect(scoreBudget(price(50_000), budget({ min: 100_000 }))).toEqual({
      score: 0.6,
      fit: "BELOW_MIN",
    })
  })

  it("mesure la proximité de prix pour les annonces similaires", () => {
    expect(scorePriceCloseness(100, 100)).toBe(1)
    expect(scorePriceCloseness(120, 100)).toBeCloseTo(0.5)
    expect(scorePriceCloseness(150, 100)).toBe(0)
  })
})

describe("scoring", () => {
  it("note un nouvel utilisateur sur la seule qualité, sans le pénaliser", () => {
    const result = scoreCandidate(candidate(), context())!
    expect(Object.keys(result.components)).toEqual(["quality"])
    expect(result.score).toBeGreaterThan(0.5)
    expect(result.reasons).toContain("RECENTLY_PUBLISHED")
  })

  it("redistribue les poids sur les dimensions disponibles", () => {
    const match = candidate({ neighborhoodId: 10 })
    const result = scoreCandidate(
      match,
      context({ preferences: preferences({ neighborhoodIds: [10] }) }),
    )!
    expect(result.components.location).toBe(1)
    const expected = (20 * 1 + 5 * result.components.quality!) / (20 + 5)
    expect(result.score).toBeCloseTo(expected, 3)
  })

  it("exclut une annonce au-delà du budget", () => {
    const expensive = candidate({ price: price(400_000) })
    expect(
      scoreCandidate(
        expensive,
        context({ preferences: preferences({ budget: budget() }) }),
      ),
    ).toBeNull()
  })

  it("classe le quartier préféré avant la commune, puis la ville", () => {
    const prefs = preferences({
      neighborhoodIds: [10],
      communeIds: [200],
      cityIds: [1000],
    })
    const score = (overrides: Partial<ListingCandidate>) =>
      scoreCandidate(candidate(overrides), context({ preferences: prefs }))!
        .components.location
    expect(score({ neighborhoodId: 10 })).toBe(1)
    expect(score({ neighborhoodId: 20, communeId: 200 })).toBe(0.8)
    expect(score({ neighborhoodId: 30, communeId: 300, cityId: 1000 })).toBe(
      0.2,
    )
    expect(score({ neighborhoodId: 30, communeId: 300, cityId: 9 })).toBe(0)
  })

  it("utilise la distance au point de référence", () => {
    const prefs = preferences({
      point: { latitude: 5.3, longitude: -4, radiusMeters: 5000 },
    })
    const near = scoreCandidate(
      candidate({ distanceMeters: 1000 }),
      context({ preferences: prefs }),
    )!
    expect(near.components.location).toBeCloseTo(0.8)
    expect(near.reasons).toContain("NEAR_PREFERRED_POINT")
  })

  it("explique les correspondances par contribution décroissante (3 au plus)", () => {
    const result = scoreCandidate(
      candidate({
        neighborhoodId: 10,
        bedrooms: 2,
        amenityCodes: ["PARKING", "POOL"],
      }),
      context({
        preferences: preferences({
          budget: budget(),
          neighborhoodIds: [10],
          propertyTypeIds: [1],
          bedrooms: 2,
          amenityCodes: ["PARKING"],
        }),
      }),
    )!
    expect(result.reasons).toEqual([
      "BUDGET_MATCH",
      "PREFERRED_NEIGHBORHOOD",
      "PROPERTY_TYPE_MATCH",
    ])
  })

  it("donne un score partiel à un type de même catégorie", () => {
    const result = scoreCandidate(
      candidate({ propertyTypeId: 2 }),
      context({
        preferences: preferences({
          propertyTypeIds: [1],
          propertyCategories: ["RESIDENTIAL"],
        }),
      }),
    )!
    expect(result.components.type).toBe(0.5)
  })

  it("pénalise légèrement une annonce déjà consultée", () => {
    const listing = candidate()
    const fresh = scoreCandidate(listing, context())!
    const seen = scoreCandidate(
      listing,
      context({ viewedPropertyIds: new Set([listing.propertyId]) }),
    )!
    expect(seen.score).toBeCloseTo(fresh.score * VIEWED_PENALTY, 3)
  })

  it("prend en compte l'activité récente", () => {
    const result = scoreCandidate(
      candidate({ neighborhoodId: 10, propertyTypeCode: "VILLA" }),
      context({
        behavior: {
          neighborhoods: { "10": 1 },
          communes: {},
          propertyTypes: { VILLA: 1 },
          amenities: {},
        },
      }),
    )!
    expect(result.components.behavior).toBe(1)
    expect(result.reasons).toContain("MATCHES_YOUR_ACTIVITY")
  })

  it("compare une annonce similaire à sa référence", () => {
    const reference = candidate()
    const close = scoreCandidate(
      candidate({ price: price(210_000) }),
      context({ mode: "SIMILAR", reference }),
    )!
    expect(close.components.budget).toBeCloseTo(0.875)
    expect(close.reasons).toEqual(
      expect.arrayContaining([
        "SAME_NEIGHBORHOOD",
        "SAME_PROPERTY_TYPE",
        "SIMILAR_PRICE",
      ]),
    )
    expect(
      scoreCandidate(
        candidate({ price: price(200_000, "TOTAL") }),
        context({ mode: "SIMILAR", reference }),
      ),
    ).toBeNull()
  })

  it("est déterministe", () => {
    const listings = [
      candidate(),
      candidate({ neighborhoodId: 11 }),
      candidate(),
    ]
    const input = {
      context: context({ preferences: preferences({ neighborhoodIds: [10] }) }),
      candidates: listings,
      limit: 10,
      diversity: { enabled: true, lambda: 0.3, maxPerOwner: 2 },
    }
    const first = rankWithRules(input).map((item) => item.candidate.publicId)
    const second = rankWithRules({
      ...input,
      candidates: [...listings].reverse(),
    }).map((item) => item.candidate.publicId)
    expect(second).toEqual(first)
  })

  it("annonce le niveau de personnalisation", () => {
    expect(recommendationLevel(null, null)).toBe("GENERIC")
    expect(recommendationLevel(preferences({ listingTypes: [] }), null)).toBe(
      "GENERIC",
    )
    expect(recommendationLevel(preferences(), null)).toBe("PREFERENCES")
    expect(
      recommendationLevel(null, {
        neighborhoods: { "1": 1 },
        communes: {},
        propertyTypes: {},
        amenities: {},
      }),
    ).toBe("BEHAVIOR")
  })
})

describe("diversification", () => {
  const ranked = (listing: ListingCandidate, score: number) => ({
    candidate: listing,
    score,
    components: {},
    reasons: [],
  })
  const options = { enabled: true, lambda: 0.3, maxPerOwner: 2 }

  it("repère un quasi-doublon", () => {
    const a = candidate({ createdById: 1n })
    const b = candidate({ createdById: 1n, price: price(205_000) })
    expect(listingSimilarity(a, b)).toBe(1)
    expect(
      listingSimilarity(a, candidate({ neighborhoodId: 99 })),
    ).toBeLessThan(0.5)
  })

  it("ne montre qu'une fois un même bien", () => {
    const a = candidate()
    const b = candidate({ propertyId: a.propertyId, listingType: "SALE" })
    expect(
      diversify([ranked(a, 0.9), ranked(b, 0.8)], 10, options),
    ).toHaveLength(1)
  })

  it("intercale les quartiers et les publieurs", () => {
    const owner = 42n
    const same = [0.95, 0.94, 0.93].map((score, index) =>
      ranked(
        candidate({
          createdById: owner,
          neighborhoodId: 10,
          price: price(200_000 + index * 30_000),
        }),
        score,
      ),
    )
    const other = ranked(
      candidate({ neighborhoodId: 20, propertyTypeId: 3 }),
      0.8,
    )
    const result = diversify([...same, other], 10, options)
    expect(result[1]!.candidate).toBe(other.candidate)
    // Plafond par publieur : le troisième passe en fin de liste.
    expect(result.map((item) => item.candidate.createdById)).toEqual([
      owner,
      other.candidate.createdById,
      owner,
      owner,
    ])
  })

  it("garde l'ordre de pertinence si la diversification est désactivée", () => {
    const items = [ranked(candidate(), 0.5), ranked(candidate(), 0.9)]
    const result = diversify(items, 10, { ...options, enabled: false })
    expect(result.map((item) => item.score)).toEqual([0.9, 0.5])
  })

  it("respecte la limite", () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      ranked(candidate({ neighborhoodId: index }), 1 - index / 100),
    )
    expect(diversify(items, 5, options)).toHaveLength(5)
  })
})

describe("profil comportemental", () => {
  const signal = (overrides: Partial<BehaviorSignal>): BehaviorSignal => ({
    kind: "FAVORITE",
    occurredAt: new Date(AS_OF.getTime() - DAY),
    propertyId: 1n,
    durationMs: null,
    neighborhoodId: 10,
    communeId: 100,
    propertyTypeCode: "APARTMENT",
    amenityCodes: ["PARKING"],
    ...overrides,
  })
  const options = { asOf: AS_OF, lookbackDays: 90, halfLifeDays: 30 }

  it("pondère par type d'action et normalise à 1", () => {
    const profile = buildBehaviorProfile(
      [
        signal({ kind: "APPOINTMENT", neighborhoodId: 10 }),
        signal({
          kind: "VIEW",
          propertyId: 2n,
          neighborhoodId: 20,
          communeId: 200,
        }),
      ],
      options,
    )
    expect(profile.signals.neighborhoods["10"]).toBe(1)
    expect(profile.signals.neighborhoods["20"]).toBeCloseTo(1 / 8, 2)
    expect(profile.signalCount).toBe(2)
  })

  it("fait décroître les signaux anciens (demi-vie)", () => {
    const profile = buildBehaviorProfile(
      [
        signal({ neighborhoodId: 10, occurredAt: AS_OF }),
        signal({
          neighborhoodId: 20,
          occurredAt: new Date(AS_OF.getTime() - 30 * DAY),
        }),
      ],
      options,
    )
    expect(profile.signals.neighborhoods["20"]).toBeCloseTo(0.5, 2)
  })

  it("ignore les événements invalides, trop brefs, futurs ou hors fenêtre", () => {
    const profile = buildBehaviorProfile(
      [
        signal({ kind: "VIEW", durationMs: 500 }),
        signal({ occurredAt: new Date(AS_OF.getTime() + DAY) }),
        signal({ occurredAt: new Date(AS_OF.getTime() - 120 * DAY) }),
        signal({ occurredAt: new Date("invalid") }),
      ],
      options,
    )
    expect(profile.signalCount).toBe(0)
    expect(profile.signals.neighborhoods).toEqual({})
  })

  it("plafonne les consultations répétées d'un même bien", () => {
    const views = Array.from({ length: 10 }, () =>
      signal({ kind: "VIEW", propertyId: 7n, neighborhoodId: 10 }),
    )
    const profile = buildBehaviorProfile(
      [
        ...views,
        signal({ kind: "FAVORITE", propertyId: 8n, neighborhoodId: 20 }),
      ],
      options,
    )
    expect(profile.signalCount).toBe(4)
    expect(profile.signals.neighborhoods["20"]).toBe(1)
    expect(profile.signals.neighborhoods["10"]).toBeCloseTo(3 / 5, 2)
  })

  it("relit un profil stocké en ignorant les valeurs hors contrat", () => {
    expect(
      parseBehaviorSignals({
        preferredLocations: { neighborhoods: { "1": 0.5, "2": "x", "3": 4 } },
        preferredPropertyTypes: null,
        preferredAmenities: ["PARKING"],
      }),
    ).toEqual({
      neighborhoods: { "1": 0.5 },
      communes: {},
      propertyTypes: {},
      amenities: {},
    })
  })
})

describe("curseur", () => {
  const cursor = {
    context: "PERSONALIZED" as const,
    offset: 20,
    asOf: AS_OF,
    hash: "abc123",
  }

  it("fait l'aller-retour", () => {
    const raw = encodeRecommendationCursor(cursor)
    expect(
      decodeRecommendationCursor(raw, {
        context: "PERSONALIZED",
        hash: "abc123",
      }),
    ).toEqual(cursor)
  })

  it("refuse un curseur d'une autre requête, d'un autre contexte ou altéré", () => {
    const raw = encodeRecommendationCursor(cursor)
    expect(() =>
      decodeRecommendationCursor(raw, {
        context: "PERSONALIZED",
        hash: "other",
      }),
    ).toThrow()
    expect(() =>
      decodeRecommendationCursor(raw, { context: "SIMILAR", hash: "abc123" }),
    ).toThrow()
    expect(() =>
      decodeRecommendationCursor(`${raw}!`, {
        context: "PERSONALIZED",
        hash: "abc123",
      }),
    ).toThrow()
    const forged = Buffer.from(
      JSON.stringify({
        v: 1,
        c: "P",
        o: -5,
        t: AS_OF.toISOString(),
        h: "abc123",
      }),
    ).toString("base64url")
    expect(() =>
      decodeRecommendationCursor(forged, {
        context: "PERSONALIZED",
        hash: "abc123",
      }),
    ).toThrow()
  })

  it("calcule une empreinte indépendante de l'ordre des clés", () => {
    expect(fingerprint({ a: 1, b: [2n] })).toBe(fingerprint({ b: [2n], a: 1 }))
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }))
  })
})
