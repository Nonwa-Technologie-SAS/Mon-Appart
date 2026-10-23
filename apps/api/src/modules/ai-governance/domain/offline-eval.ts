/**
 * Évaluation hors ligne du classifieur rules-v1 + baselines simples.
 * Utilise les métriques existantes (precision/recall/ndcg/coverage/diversity).
 */

import { budgetCeiling } from "../../recommendation/domain/budget"
import {
  attributeDiversity,
  averagePrecisionAtK,
  catalogCoverage,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  type RankedId,
} from "../../recommendation/domain/evaluation-metrics"
import { rankWithRules } from "../../recommendation/domain/recommendation-engine"
import type {
  ListingCandidate,
  RankedRecommendation,
  RankingInput,
} from "../../recommendation/domain/recommendation-input"
import {
  EVAL_DATASET_KIND,
  EVAL_DATASET_VERSION,
  SYNTHETIC_LABELS,
  syntheticRankingInput,
} from "./eval-fixtures"

export interface EngineEvalSlice {
  name: string
  version: string
  emptyRate: number
  precisionAt5: number
  recallAt5: number
  ndcgAt5: number
  mapAt5: number
  catalogCoverage: number
  communeDiversity: number
  ownerRedundancy: number
  budgetViolationRate: number
  typeMatchRate: number
  rankedPublicIds: string[]
}

export interface OfflineEvalReport {
  dataset: {
    kind: typeof EVAL_DATASET_KIND
    version: typeof EVAL_DATASET_VERSION
    note: string
  }
  k: number
  engines: EngineEvalSlice[]
  winner: string | null
  comparedToFreshness: {
    engine: string
    ndcgDelta: number
    precisionDelta: number
  } | null
}

function relevanceById(): Map<string, number> {
  return new Map(SYNTHETIC_LABELS.map((row) => [row.publicId, row.relevance]))
}

function toRankedIds(items: readonly RankedRecommendation[]): RankedId[] {
  const labels = relevanceById()
  return items.map((item) => ({
    id: item.candidate.publicId,
    relevance: labels.get(item.candidate.publicId) ?? 0,
  }))
}

function relevantSet(): Set<string> {
  return new Set(
    SYNTHETIC_LABELS.filter((row) => row.relevance > 0).map(
      (row) => row.publicId,
    ),
  )
}

function ownerRedundancy(items: readonly RankedRecommendation[]): number {
  if (items.length <= 1) return 0
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = item.candidate.createdById.toString()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let extra = 0
  for (const count of counts.values()) extra += Math.max(0, count - 1)
  return extra / items.length
}

function budgetViolationRate(
  items: readonly RankedRecommendation[],
  input: RankingInput,
): number {
  const budget = input.context.preferences?.budget
  if (!budget || items.length === 0) return 0
  const ceiling = budgetCeiling(budget)
  if (ceiling === null) return 0
  const bad = items.filter((item) => item.candidate.price.amount > ceiling)
  return bad.length / items.length
}

function typeMatchRate(
  items: readonly RankedRecommendation[],
  input: RankingInput,
): number {
  const allowed = input.context.preferences?.propertyTypeIds ?? []
  if (allowed.length === 0 || items.length === 0) return 1
  const hits = items.filter((item) =>
    allowed.includes(item.candidate.propertyTypeId),
  ).length
  return hits / items.length
}

function sliceOf(
  name: string,
  version: string,
  items: readonly RankedRecommendation[],
  input: RankingInput,
  k: number,
): EngineEvalSlice {
  const ranked = toRankedIds(items)
  const catalog = new Set(input.candidates.map((row) => row.publicId))
  return {
    name,
    version,
    emptyRate: items.length === 0 ? 1 : 0,
    precisionAt5: precisionAtK(ranked, k),
    recallAt5: recallAtK(ranked, relevantSet(), k),
    ndcgAt5: ndcgAtK(ranked, k),
    mapAt5: averagePrecisionAtK(ranked, k),
    catalogCoverage: catalogCoverage(
      items.map((item) => item.candidate.publicId),
      catalog,
    ),
    communeDiversity: attributeDiversity(
      items.map((item) => String(item.candidate.communeId)),
    ),
    ownerRedundancy: ownerRedundancy(items),
    budgetViolationRate: budgetViolationRate(items, input),
    typeMatchRate: typeMatchRate(items, input),
    rankedPublicIds: items.map((item) => item.candidate.publicId),
  }
}

function wrap(
  candidates: readonly ListingCandidate[],
  order: readonly ListingCandidate[],
): RankedRecommendation[] {
  const allowed = new Set(candidates.map((row) => row.publicId))
  return order
    .filter((row) => allowed.has(row.publicId))
    .map((candidate, index) => ({
      candidate,
      score: Math.max(0, 1 - index * 0.05),
      components: {},
      reasons: [],
    }))
}

/** Baseline : tri par date de publication (plus récent d’abord). */
export function rankByFreshness(input: RankingInput): RankedRecommendation[] {
  const ordered = [...input.candidates].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  )
  return wrap(input.candidates, ordered).slice(0, input.limit)
}

/** Baseline : popularité brute (vues récentes). Non utilisée en production. */
export function rankByPopularity(input: RankingInput): RankedRecommendation[] {
  const ordered = [...input.candidates].sort(
    (a, b) => b.recentViews - a.recentViews,
  )
  return wrap(input.candidates, ordered).slice(0, input.limit)
}

export function evaluateRecommendationOffline(k = 5): OfflineEvalReport {
  const input = syntheticRankingInput()
  const rules = rankWithRules(input)
  const freshness = rankByFreshness(input)
  const popularity = rankByPopularity(input)

  const engines = [
    sliceOf("rules", "rules-v1", rules, input, k),
    sliceOf("freshness", "baseline-freshness", freshness, input, k),
    sliceOf("popularity", "baseline-popularity", popularity, input, k),
  ]

  const rulesSlice = engines[0]!
  const freshSlice = engines[1]!
  let winner: string | null = "rules"
  if (rulesSlice.ndcgAt5 < freshSlice.ndcgAt5) winner = "freshness"
  if (
    engines[2]!.ndcgAt5 >
    (winner === "rules" ? rulesSlice.ndcgAt5 : freshSlice.ndcgAt5)
  ) {
    winner = "popularity"
  }

  return {
    dataset: {
      kind: EVAL_DATASET_KIND,
      version: EVAL_DATASET_VERSION,
      note: "Jeu synthétique. Un gain ici ne prouve pas une amélioration en production.",
    },
    k,
    engines,
    winner,
    comparedToFreshness: {
      engine: "rules-v1",
      ndcgDelta: rulesSlice.ndcgAt5 - freshSlice.ndcgAt5,
      precisionDelta: rulesSlice.precisionAt5 - freshSlice.precisionAt5,
    },
  }
}
