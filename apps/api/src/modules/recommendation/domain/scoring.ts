import type { RecommendationDimension } from "@mon-appart/config"
import type { RecommendationReasonCode } from "@mon-appart/types"

import { scoreBudget, scorePriceCloseness } from "./budget"
import type {
  BehaviorSignals,
  DeclaredPreferences,
  ListingCandidate,
  RankedRecommendation,
  ScoreComponents,
  ScoringContext,
} from "./recommendation-input"

/** Une dimension évaluée : score 0..1 et raisons qu'elle justifie. */
interface Dimension {
  score: number
  reasons: RecommendationReasonCode[]
}

/** `null` : dimension sans signal pour ce contexte, son poids est redistribué. */
type DimensionResult = Dimension | null

const FRESHNESS_HALF_LIFE_DAYS = 30
const RECENT_DAYS = 7
const POPULAR_VIEWS = 20
const POPULARITY_SATURATION = 50
const COMPLETE_QUALITY = 0.8
/** Une annonce déjà consultée reste proposable, un peu plus bas. */
export const VIEWED_PENALTY = 0.9
/** Contribution minimale (poids × score) pour qu'une dimension devienne une raison. */
const REASON_MIN_SCORE = 0.6
const MAX_REASONS = 3

const DAY_MS = 86_400_000

/**
 * Score 0..1 d'une annonce dans un contexte, avec le détail par dimension et
 * des raisons ordonnées par contribution. `null` : annonce inéligible (prix
 * hors plafond ou incomparable au budget). Fonction pure et déterministe.
 */
export function scoreCandidate(
  candidate: ListingCandidate,
  context: ScoringContext,
): RankedRecommendation | null {
  const dimensions =
    context.mode === "SIMILAR" && context.reference
      ? similarDimensions(candidate, context.reference)
      : personalizedDimensions(candidate, context.preferences)
  if (dimensions === null) return null
  dimensions.behavior = context.behavior
    ? scoreBehavior(candidate, context.behavior)
    : null
  dimensions.quality = scoreQuality(candidate, context.asOf)

  let weighted = 0
  let totalWeight = 0
  const components: ScoreComponents = {}
  const contributions: Array<{ weight: number; dimension: Dimension }> = []
  for (const [name, dimension] of Object.entries(dimensions) as Array<
    [RecommendationDimension, DimensionResult]
  >) {
    if (!dimension) continue
    const weight = context.weights[name]
    if (weight <= 0) continue
    const score = clamp(dimension.score)
    weighted += weight * score
    totalWeight += weight
    components[name] = round(score)
    contributions.push({ weight: weight * score, dimension })
  }

  let score = totalWeight > 0 ? weighted / totalWeight : 0
  if (context.viewedPropertyIds.has(candidate.propertyId)) {
    score *= VIEWED_PENALTY
  }
  return {
    candidate,
    score: round(score),
    components,
    reasons: pickReasons(contributions),
  }
}

/** Classement stable : score, puis publication la plus récente, puis identifiant. */
export function compareRanked(
  a: RankedRecommendation,
  b: RankedRecommendation,
): number {
  return (
    b.score - a.score ||
    b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime() ||
    (a.candidate.listingId < b.candidate.listingId ? 1 : -1)
  )
}

function personalizedDimensions(
  candidate: ListingCandidate,
  preferences: DeclaredPreferences | null,
): Partial<Record<RecommendationDimension, DimensionResult>> | null {
  if (!preferences) return {}
  let budget: DimensionResult = null
  if (preferences.budget) {
    const fit = scoreBudget(candidate.price, preferences.budget)
    if (!fit) return null
    budget = {
      score: fit.score,
      reasons:
        fit.fit === "WITHIN"
          ? ["BUDGET_MATCH"]
          : fit.fit === "WITHIN_TOLERANCE"
            ? ["BUDGET_WITHIN_TOLERANCE"]
            : [],
    }
  }
  return {
    budget,
    location: scoreLocation(candidate, preferences),
    type: scoreType(candidate, preferences),
    size: scoreSize(candidate, preferences),
    amenities: scoreAmenities(candidate, preferences.amenityCodes),
  }
}

function scoreLocation(
  candidate: ListingCandidate,
  preferences: DeclaredPreferences,
): DimensionResult {
  const hasArea =
    preferences.neighborhoodIds.length > 0 || preferences.communeIds.length > 0
  if (!hasArea && !preferences.point) return null

  let best: Dimension = { score: 0, reasons: [] }
  const consider = (score: number, reason?: RecommendationReasonCode) => {
    if (score > best.score) best = { score, reasons: reason ? [reason] : [] }
  }
  if (hasArea) {
    if (preferences.neighborhoodIds.includes(candidate.neighborhoodId)) {
      consider(1, "PREFERRED_NEIGHBORHOOD")
    } else if (preferences.communeIds.includes(candidate.communeId)) {
      consider(0.8, "PREFERRED_COMMUNE")
    } else if (preferences.nearbyCommuneIds.includes(candidate.communeId)) {
      consider(0.5)
    } else if (preferences.cityIds.includes(candidate.cityId)) {
      consider(0.2)
    }
  }
  if (preferences.point && candidate.distanceMeters !== null) {
    const closeness = Math.max(
      0,
      1 - candidate.distanceMeters / preferences.point.radiusMeters,
    )
    consider(closeness, closeness >= 0.5 ? "NEAR_PREFERRED_POINT" : undefined)
  }
  return best
}

function scoreType(
  candidate: ListingCandidate,
  preferences: DeclaredPreferences,
): DimensionResult {
  if (preferences.propertyTypeIds.length === 0) return null
  if (preferences.propertyTypeIds.includes(candidate.propertyTypeId)) {
    return { score: 1, reasons: ["PROPERTY_TYPE_MATCH"] }
  }
  if (preferences.propertyCategories.includes(candidate.propertyCategory)) {
    return { score: 0.5, reasons: [] }
  }
  return { score: 0, reasons: [] }
}

/** Valeur inconnue côté annonce : ni récompensée, ni éliminée. */
const UNKNOWN_SIZE_SCORE = 0.3

function scoreSize(
  candidate: ListingCandidate,
  preferences: DeclaredPreferences,
): DimensionResult {
  const parts: Dimension[] = []
  const { bedrooms, bathrooms, surface } = preferences
  if (bedrooms !== null) {
    const actual = candidate.bedrooms
    let score = UNKNOWN_SIZE_SCORE
    if (actual !== null) {
      score =
        actual >= bedrooms
          ? Math.max(0.6, 1 - 0.2 * (actual - bedrooms))
          : Math.max(0, 1 - 0.5 * (bedrooms - actual))
    }
    parts.push({
      score,
      reasons: actual !== null && score >= 0.8 ? ["BEDROOMS_MATCH"] : [],
    })
  }
  if (bathrooms !== null) {
    const actual = candidate.bathrooms
    parts.push({
      score:
        actual === null
          ? UNKNOWN_SIZE_SCORE
          : actual >= bathrooms
            ? 1
            : Math.max(0, 1 - 0.5 * (bathrooms - actual)),
      reasons: [],
    })
  }
  if (surface.min !== null || surface.max !== null) {
    const area = candidate.surface ?? candidate.landSurface
    let score = UNKNOWN_SIZE_SCORE
    if (area !== null) {
      if (surface.min !== null && area < surface.min) {
        score = Math.max(0, 1 - (surface.min - area) / surface.min)
      } else if (surface.max !== null && area > surface.max) {
        score = Math.max(0, 1 - (area - surface.max) / surface.max)
      } else {
        score = 1
      }
    }
    parts.push({ score, reasons: score === 1 ? ["SURFACE_MATCH"] : [] })
  }
  return average(parts)
}

function scoreAmenities(
  candidate: ListingCandidate,
  wanted: readonly string[],
): DimensionResult {
  if (wanted.length === 0) return null
  const available = new Set(candidate.amenityCodes)
  const matched = wanted.filter((code) => available.has(code)).length
  const score = matched / wanted.length
  return {
    score,
    reasons: matched > 0 && score >= 0.5 ? ["AMENITIES_MATCH"] : [],
  }
}

function similarDimensions(
  candidate: ListingCandidate,
  reference: ListingCandidate,
): Partial<Record<RecommendationDimension, DimensionResult>> | null {
  if (
    candidate.price.currency !== reference.price.currency ||
    candidate.price.period !== reference.price.period
  ) {
    return null
  }
  const price = scorePriceCloseness(
    candidate.price.amount,
    reference.price.amount,
  )

  const location: Dimension =
    candidate.neighborhoodId === reference.neighborhoodId
      ? { score: 1, reasons: ["SAME_NEIGHBORHOOD"] }
      : candidate.communeId === reference.communeId
        ? { score: 0.7, reasons: ["SAME_COMMUNE"] }
        : {
            score: candidate.cityId === reference.cityId ? 0.3 : 0,
            reasons: [],
          }

  const type: Dimension =
    candidate.propertyTypeId === reference.propertyTypeId
      ? { score: 1, reasons: ["SAME_PROPERTY_TYPE"] }
      : {
          score:
            candidate.propertyCategory === reference.propertyCategory ? 0.5 : 0,
          reasons: [],
        }

  const sizeParts: Dimension[] = []
  if (reference.bedrooms !== null && candidate.bedrooms !== null) {
    sizeParts.push({
      score: Math.max(
        0,
        1 - 0.34 * Math.abs(candidate.bedrooms - reference.bedrooms),
      ),
      reasons: [],
    })
  }
  const referenceArea = reference.surface ?? reference.landSurface
  const area = candidate.surface ?? candidate.landSurface
  if (referenceArea !== null && referenceArea > 0 && area !== null) {
    sizeParts.push({
      score: Math.max(0, 1 - Math.abs(area - referenceArea) / referenceArea),
      reasons: [],
    })
  }

  let amenities: DimensionResult = null
  if (reference.amenityCodes.length > 0) {
    const mine = new Set(candidate.amenityCodes)
    const shared = reference.amenityCodes.filter((code) =>
      mine.has(code),
    ).length
    const union = new Set([
      ...reference.amenityCodes,
      ...candidate.amenityCodes,
    ]).size
    amenities = { score: shared / union, reasons: [] }
  }

  return {
    budget: { score: price, reasons: price >= 0.6 ? ["SIMILAR_PRICE"] : [] },
    location,
    type,
    size: average(sizeParts),
    amenities,
  }
}

/** Affinité avec l'activité : lieu 50 %, type 30 %, équipements 20 % (renormalisés). */
function scoreBehavior(
  candidate: ListingCandidate,
  behavior: BehaviorSignals,
): DimensionResult {
  const parts: Array<{ weight: number; score: number }> = []
  const hasLocation =
    Object.keys(behavior.neighborhoods).length > 0 ||
    Object.keys(behavior.communes).length > 0
  if (hasLocation) {
    parts.push({
      weight: 0.5,
      score: Math.max(
        behavior.neighborhoods[String(candidate.neighborhoodId)] ?? 0,
        0.7 * (behavior.communes[String(candidate.communeId)] ?? 0),
      ),
    })
  }
  if (Object.keys(behavior.propertyTypes).length > 0) {
    parts.push({
      weight: 0.3,
      score: behavior.propertyTypes[candidate.propertyTypeCode] ?? 0,
    })
  }
  const amenityWeights = Object.values(behavior.amenities)
  if (amenityWeights.length > 0) {
    const total = amenityWeights.reduce((sum, weight) => sum + weight, 0)
    const covered = candidate.amenityCodes.reduce(
      (sum, code) => sum + (behavior.amenities[code] ?? 0),
      0,
    )
    parts.push({ weight: 0.2, score: total > 0 ? covered / total : 0 })
  }
  if (parts.length === 0) return null
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0)
  const score =
    parts.reduce((sum, part) => sum + part.weight * part.score, 0) / weightSum
  return { score, reasons: score >= 0.5 ? ["MATCHES_YOUR_ACTIVITY"] : [] }
}

/** Complétude 40 %, fraîcheur 40 %, popularité récente 20 %. */
function scoreQuality(candidate: ListingCandidate, asOf: Date): Dimension {
  const ageDays = Math.max(
    0,
    (asOf.getTime() - candidate.publishedAt.getTime()) / DAY_MS,
  )
  const freshness = 1 / (1 + ageDays / FRESHNESS_HALF_LIFE_DAYS)
  const popularity = Math.min(
    1,
    Math.log1p(candidate.recentViews) / Math.log1p(POPULARITY_SATURATION),
  )
  const reasons: RecommendationReasonCode[] = []
  if (ageDays <= RECENT_DAYS) reasons.push("RECENTLY_PUBLISHED")
  if (candidate.qualityScore >= COMPLETE_QUALITY)
    reasons.push("COMPLETE_LISTING")
  if (candidate.recentViews >= POPULAR_VIEWS) reasons.push("POPULAR")
  return {
    score: 0.4 * candidate.qualityScore + 0.4 * freshness + 0.2 * popularity,
    reasons,
  }
}

function average(parts: Dimension[]): DimensionResult {
  if (parts.length === 0) return null
  return {
    score: parts.reduce((sum, part) => sum + part.score, 0) / parts.length,
    reasons: parts.flatMap((part) => part.reasons),
  }
}

/** Raisons des dimensions les plus contributives, sans doublon. */
function pickReasons(
  contributions: Array<{ weight: number; dimension: Dimension }>,
): RecommendationReasonCode[] {
  const reasons: RecommendationReasonCode[] = []
  const ordered = contributions
    .filter((entry) => entry.dimension.score >= REASON_MIN_SCORE)
    .sort((a, b) => b.weight - a.weight)
  for (const { dimension } of ordered) {
    for (const reason of dimension.reasons) {
      if (!reasons.includes(reason)) reasons.push(reason)
      if (reasons.length === MAX_REASONS) return reasons
    }
  }
  return reasons
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const round = (value: number) => Math.round(value * 10_000) / 10_000
