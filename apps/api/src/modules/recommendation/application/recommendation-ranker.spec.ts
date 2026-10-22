import type { ConfigService } from "@nestjs/config"
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  parseRecommendationWeights,
} from "@mon-appart/config"
import { describe, expect, it, vi } from "vitest"

import { MetricsService } from "../../../observability/metrics.service"
import { RULES_ENGINE_VERSION } from "../domain/recommendation-engine"
import type {
  ListingCandidate,
  RankingInput,
} from "../domain/recommendation-input"
import {
  REMOTE_ENGINE_VERSION,
  RemoteRecommendationEngine,
} from "../infrastructure/remote-recommendation.engine"
import { RecommendationRanker } from "./recommendation-ranker"

const AS_OF = new Date("2026-10-09T12:00:00Z")

function candidate(id: number): ListingCandidate {
  return {
    listingId: BigInt(id),
    publicId: `00000000-0000-4000-8000-00000000000${id}`,
    propertyId: BigInt(100 + id),
    createdById: BigInt(200 + id),
    listingType: "RENT",
    propertyTypeId: 1,
    propertyTypeCode: "APARTMENT",
    propertyCategory: "RESIDENTIAL",
    neighborhoodId: id,
    communeId: 1,
    cityId: 1,
    price: { amount: 100_000 * id, currency: "XOF", period: "MONTH" },
    surface: 50,
    landSurface: null,
    bedrooms: 2,
    bathrooms: 1,
    publishedAt: new Date(AS_OF.getTime() - id * 86_400_000),
    qualityScore: 0.5,
    distanceMeters: null,
    amenityCodes: [],
    recentViews: 0,
  }
}

const input: RankingInput = {
  context: {
    mode: "PERSONALIZED",
    weights: parseRecommendationWeights(DEFAULT_RECOMMENDATION_WEIGHTS),
    preferences: null,
    behavior: null,
    reference: null,
    viewedPropertyIds: new Set(),
    asOf: AS_OF,
  },
  candidates: [candidate(1), candidate(2), candidate(3)],
  limit: 10,
  diversity: { enabled: false, lambda: 0, maxPerOwner: 2 },
}

const metrics = () =>
  new MetricsService({ get: () => "false" } as unknown as ConfigService)

const respond = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )

describe("RecommendationRanker", () => {
  it("utilise les règles sans moteur distant", async () => {
    const result = await new RecommendationRanker(null, metrics()).rank(input)
    expect(result.algorithmVersion).toBe(RULES_ENGINE_VERSION)
    expect(result.degraded).toBe(false)
    expect(result.items.map((item) => item.candidate.listingId)).toEqual([
      1n,
      2n,
      3n,
    ])
  })

  it("suit l'ordre du moteur distant et filtre les raisons inconnues", async () => {
    const fetcher = respond({
      items: [
        {
          listingId: candidate(3).publicId,
          score: 0.9,
          reasons: ["BUDGET_MATCH", "SECRET"],
        },
        { listingId: candidate(1).publicId, score: 0.4 },
      ],
    })
    const remote = new RemoteRecommendationEngine(
      "http://rec.local",
      500,
      fetcher,
    )
    const result = await new RecommendationRanker(remote, metrics()).rank(input)
    expect(result.algorithmVersion).toBe(REMOTE_ENGINE_VERSION)
    expect(result.items.map((item) => item.candidate.listingId)).toEqual([
      3n,
      1n,
    ])
    expect(result.items[0]!.reasons).toEqual(["BUDGET_MATCH"])
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://rec.local/v1/rank")
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>
    // Le service distant ne reçoit aucun identifiant interne ni d'identité.
    expect(JSON.stringify(sent)).not.toMatch(/userId|createdById|"propertyId"/)
  })

  it.each([
    ["statut en erreur", respond({}, 500)],
    ["contrat invalide", respond({ items: "x" })],
    [
      "annonce hors du pool",
      respond({ items: [{ listingId: "other", score: 0.5 }] }),
    ],
    [
      "score hors bornes",
      respond({ items: [{ listingId: candidate(1).publicId, score: 2 }] }),
    ],
    [
      "délai dépassé",
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("t"), { name: "TimeoutError" }),
        ),
    ],
  ])("retombe sur les règles : %s", async (_label, fetcher) => {
    const registry = metrics()
    const remote = new RemoteRecommendationEngine(
      "http://rec.local",
      500,
      fetcher,
    )
    const result = await new RecommendationRanker(remote, registry).rank(input)
    expect(result.degraded).toBe(true)
    expect(result.algorithmVersion).toBe(RULES_ENGINE_VERSION)
    expect(result.items).toHaveLength(3)
    const fallbacks = await registry.recommendation.fallbacks.get()
    expect(fallbacks.values.reduce((sum, value) => sum + value.value, 0)).toBe(
      1,
    )
  })
})
