/**
 * Jeu d’évaluation SYNTHÉTIQUE du classifieur rules-v1.
 * Ce n’est pas un échantillon statistique d’utilisateurs réels.
 */

import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  parseRecommendationWeights,
} from "@mon-appart/config"

import type {
  DeclaredPreferences,
  ListingCandidate,
  RankingInput,
} from "../../recommendation/domain/recommendation-input"

export const EVAL_DATASET_KIND = "synthetic" as const
export const EVAL_DATASET_VERSION = "reco-eval-synthetic-v1"

const AS_OF = new Date("2026-10-09T12:00:00Z")
const DAY = 86_400_000

/** Pertinence graduée (0..3) — hiérarchie de signaux, pas un clic isolé. */
export const SIGNAL_WEIGHT = {
  impression: 0,
  detail_view: 1,
  favorite: 2,
  contact_or_visit: 3,
} as const

export interface SyntheticLabel {
  publicId: string
  relevance: number
  commune: "COCODY" | "YOPOUGON"
  type: "APARTMENT" | "HOUSE"
  overBudget: boolean
}

function candidate(params: {
  id: number
  type: "APARTMENT" | "HOUSE"
  communeId: number
  neighborhoodId: number
  amount: number
  owner: number
  daysAgo: number
  views: number
  quality: number
}): ListingCandidate {
  return {
    listingId: BigInt(params.id),
    publicId: `00000000-0000-4000-8000-00000000000${params.id}`,
    propertyId: BigInt(100 + params.id),
    createdById: BigInt(params.owner),
    listingType: "RENT",
    propertyTypeId: params.type === "APARTMENT" ? 1 : 2,
    propertyTypeCode: params.type,
    propertyCategory: "RESIDENTIAL",
    neighborhoodId: params.neighborhoodId,
    communeId: params.communeId,
    cityId: 1,
    price: { amount: params.amount, currency: "XOF", period: "MONTH" },
    surface: 70,
    landSurface: null,
    bedrooms: 2,
    bathrooms: 1,
    publishedAt: new Date(AS_OF.getTime() - params.daysAgo * DAY),
    qualityScore: params.quality,
    distanceMeters: null,
    amenityCodes: [],
    recentViews: params.views,
  }
}

/** Catalogue synthétique Cocody / Yopougon, budget 250 000 XOF. */
export const SYNTHETIC_CANDIDATES: readonly ListingCandidate[] = [
  candidate({
    id: 1,
    type: "APARTMENT",
    communeId: 1,
    neighborhoodId: 11,
    amount: 200_000,
    owner: 1,
    daysAgo: 3,
    views: 8,
    quality: 0.9,
  }),
  candidate({
    id: 2,
    type: "APARTMENT",
    communeId: 1,
    neighborhoodId: 11,
    amount: 240_000,
    owner: 2,
    daysAgo: 20,
    views: 4,
    quality: 0.8,
  }),
  candidate({
    id: 3,
    type: "APARTMENT",
    communeId: 1,
    neighborhoodId: 12,
    amount: 180_000,
    owner: 3,
    daysAgo: 40,
    views: 80,
    quality: 0.6,
  }),
  candidate({
    id: 4,
    type: "HOUSE",
    communeId: 1,
    neighborhoodId: 11,
    amount: 200_000,
    owner: 4,
    daysAgo: 2,
    views: 10,
    quality: 0.85,
  }),
  candidate({
    id: 5,
    type: "APARTMENT",
    communeId: 2,
    neighborhoodId: 21,
    amount: 200_000,
    owner: 5,
    daysAgo: 1,
    views: 30,
    quality: 0.7,
  }),
  candidate({
    id: 6,
    type: "APARTMENT",
    communeId: 1,
    neighborhoodId: 11,
    amount: 400_000,
    owner: 6,
    daysAgo: 1,
    views: 50,
    quality: 0.95,
  }),
  candidate({
    id: 7,
    type: "APARTMENT",
    communeId: 1,
    neighborhoodId: 11,
    amount: 210_000,
    owner: 1,
    daysAgo: 5,
    views: 6,
    quality: 0.75,
  }),
  candidate({
    id: 8,
    type: "APARTMENT",
    communeId: 1,
    neighborhoodId: 11,
    amount: 190_000,
    owner: 8,
    daysAgo: 0,
    views: 2,
    quality: 0.88,
  }),
]

/**
 * Labels synthétiques : contact > favori > vue détail.
 * L’annonce hors budget (id 6) n’est pas pertinente.
 */
export const SYNTHETIC_LABELS: readonly SyntheticLabel[] = [
  {
    publicId: SYNTHETIC_CANDIDATES[0]!.publicId,
    relevance: SIGNAL_WEIGHT.contact_or_visit,
    commune: "COCODY",
    type: "APARTMENT",
    overBudget: false,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[1]!.publicId,
    relevance: SIGNAL_WEIGHT.favorite,
    commune: "COCODY",
    type: "APARTMENT",
    overBudget: false,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[2]!.publicId,
    relevance: SIGNAL_WEIGHT.detail_view,
    commune: "COCODY",
    type: "APARTMENT",
    overBudget: false,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[3]!.publicId,
    relevance: SIGNAL_WEIGHT.impression,
    commune: "COCODY",
    type: "HOUSE",
    overBudget: false,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[4]!.publicId,
    relevance: SIGNAL_WEIGHT.impression,
    commune: "YOPOUGON",
    type: "APARTMENT",
    overBudget: false,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[5]!.publicId,
    relevance: SIGNAL_WEIGHT.impression,
    commune: "COCODY",
    type: "APARTMENT",
    overBudget: true,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[6]!.publicId,
    relevance: SIGNAL_WEIGHT.favorite,
    commune: "COCODY",
    type: "APARTMENT",
    overBudget: false,
  },
  {
    publicId: SYNTHETIC_CANDIDATES[7]!.publicId,
    relevance: SIGNAL_WEIGHT.favorite,
    commune: "COCODY",
    type: "APARTMENT",
    overBudget: false,
  },
]

export const SYNTHETIC_PREFERENCES: DeclaredPreferences = {
  listingTypes: ["RENT"],
  budget: {
    min: null,
    max: 250_000,
    currency: "XOF",
    period: "MONTH",
    tolerancePct: 0,
  },
  propertyTypeIds: [1],
  propertyCategories: ["RESIDENTIAL"],
  neighborhoodIds: [11],
  communeIds: [1],
  nearbyCommuneIds: [],
  cityIds: [1],
  amenityCodes: [],
  bedrooms: 2,
  bathrooms: null,
  surface: { min: null, max: null },
  point: null,
}

export function syntheticRankingInput(): RankingInput {
  return {
    context: {
      mode: "PERSONALIZED",
      weights: parseRecommendationWeights(DEFAULT_RECOMMENDATION_WEIGHTS),
      preferences: SYNTHETIC_PREFERENCES,
      behavior: null,
      reference: null,
      viewedPropertyIds: new Set(),
      asOf: AS_OF,
    },
    candidates: [...SYNTHETIC_CANDIDATES],
    limit: 10,
    diversity: { enabled: true, lambda: 0.3, maxPerOwner: 2 },
  }
}
