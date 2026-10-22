import type { RecommendationReasonCode } from "@mon-appart/types"

import { diversify } from "./diversification"
import type { RankedRecommendation, RankingInput } from "./recommendation-input"
import { compareRanked, scoreCandidate } from "./scoring"

const DIVERSITY_REASON: RecommendationReasonCode = "DIVERSITY_ADJUSTMENT"

/**
 * Port de classement. Le moteur à règles l'implémente toujours ; un moteur
 * distant (service Python) est optionnel et retombe sur les règles.
 * Entrée : candidats déjà filtrés (filtres stricts appliqués en amont).
 */
export interface RecommendationEngine {
  readonly name: string
  /** Version persistée avec chaque recommandation (`algorithm_version`). */
  readonly version: string
  rank(input: RankingInput): Promise<RankedRecommendation[]>
}

export const RULES_ENGINE_VERSION = "rules-v1"

/** Moteur déterministe : score pondéré explicable, puis diversification. */
export class RuleBasedRecommendationEngine implements RecommendationEngine {
  readonly name = "rules"
  readonly version = RULES_ENGINE_VERSION

  rank(input: RankingInput): Promise<RankedRecommendation[]> {
    return Promise.resolve(rankWithRules(input))
  }
}

export function rankWithRules(input: RankingInput): RankedRecommendation[] {
  const scored = input.candidates.flatMap((candidate) => {
    const result = scoreCandidate(candidate, input.context)
    return result ? [result] : []
  })
  const byScore = [...scored].sort(compareRanked)
  const diversified = diversify(scored, input.limit, input.diversity)
  return annotateDiversityAdjustment(byScore, diversified)
}

/**
 * Marque les annonces avancées par la diversification MMR (fait vérifiable :
 * rang après diversité < rang après score seul).
 */
export function annotateDiversityAdjustment(
  byScore: readonly RankedRecommendation[],
  diversified: readonly RankedRecommendation[],
): RankedRecommendation[] {
  const scoreRank = new Map(
    byScore.map((item, index) => [item.candidate.listingId, index]),
  )
  return diversified.map((item, index) => {
    const previous = scoreRank.get(item.candidate.listingId)
    if (previous === undefined || previous <= index) return item
    if (item.reasons.includes(DIVERSITY_REASON)) return item
    return {
      ...item,
      reasons: [...item.reasons, DIVERSITY_REASON].slice(0, 3),
    }
  })
}
