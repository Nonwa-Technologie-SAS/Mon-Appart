import {
  RECOMMENDATION_REASON_LABELS,
  type RecommendationReasonCode,
} from "@mon-appart/types"

import { diversify } from "../domain/diversification"
import {
  annotateDiversityAdjustment,
  type RecommendationEngine,
} from "../domain/recommendation-engine"
import type {
  RankedRecommendation,
  RankingInput,
} from "../domain/recommendation-input"
import { compareRanked } from "../domain/scoring"

export const REMOTE_ENGINE_VERSION = "remote-v1"

type Fetch = typeof fetch

interface RemoteItem {
  listingId: string
  score: number
  reasons?: string[]
}

/**
 * Client du futur service `services/recommendation` (FastAPI). Il ne reçoit
 * que des caractéristiques d'annonces et des préférences résolues, jamais
 * d'identité. Toute réponse hors contrat est une erreur : l'appelant
 * retombe alors sur le moteur à règles.
 */
export class RemoteRecommendationEngine implements RecommendationEngine {
  readonly name = "remote"
  readonly version = REMOTE_ENGINE_VERSION

  constructor(
    private readonly url: string,
    private readonly timeoutMs: number,
    private readonly fetcher: Fetch = fetch,
  ) {}

  async rank(input: RankingInput): Promise<RankedRecommendation[]> {
    const response = await this.fetcher(`${this.url}/v1/rank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(input)),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) throw new Error(`remote status ${response.status}`)
    const body = (await response.json()) as { items?: unknown }
    if (!Array.isArray(body.items)) throw new Error("remote payload")

    const byId = new Map(
      input.candidates.map((candidate) => [candidate.publicId, candidate]),
    )
    const ranked: RankedRecommendation[] = []
    for (const raw of body.items as RemoteItem[]) {
      const candidate =
        raw && typeof raw.listingId === "string"
          ? byId.get(raw.listingId)
          : undefined
      // Un identifiant hors du pool violerait les filtres stricts : rejeté.
      if (!candidate) throw new Error("remote unknown listing")
      if (
        typeof raw.score !== "number" ||
        !(raw.score >= 0 && raw.score <= 1)
      ) {
        throw new Error("remote score")
      }
      ranked.push({
        candidate,
        score: Math.round(raw.score * 10_000) / 10_000,
        components: {},
        reasons: (raw.reasons ?? []).filter(isReasonCode).slice(0, 3),
      })
    }
    const byScore = [...ranked].sort(compareRanked)
    const diversified = diversify(ranked, input.limit, input.diversity)
    return annotateDiversityAdjustment(byScore, diversified)
  }
}

function isReasonCode(value: unknown): value is RecommendationReasonCode {
  return typeof value === "string" && value in RECOMMENDATION_REASON_LABELS
}

function payload(input: RankingInput) {
  const { context } = input
  return {
    mode: context.mode,
    asOf: context.asOf.toISOString(),
    limit: input.limit,
    weights: context.weights,
    preferences: context.preferences,
    behavior: context.behavior,
    reference: context.reference ? features(context.reference) : null,
    candidates: input.candidates.map(features),
  }
}

function features(candidate: RankingInput["candidates"][number]) {
  return {
    listingId: candidate.publicId,
    listingType: candidate.listingType,
    propertyType: candidate.propertyTypeCode,
    propertyCategory: candidate.propertyCategory,
    neighborhoodId: candidate.neighborhoodId,
    communeId: candidate.communeId,
    cityId: candidate.cityId,
    price: candidate.price,
    surface: candidate.surface,
    landSurface: candidate.landSurface,
    bedrooms: candidate.bedrooms,
    bathrooms: candidate.bathrooms,
    amenities: candidate.amenityCodes,
    publishedAt: candidate.publishedAt.toISOString(),
    qualityScore: candidate.qualityScore,
    distanceMeters: candidate.distanceMeters,
    recentViews: candidate.recentViews,
  }
}
