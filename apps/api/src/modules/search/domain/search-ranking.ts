/**
 * Score de pertinence (tri RELEVANCE), défini en un seul endroit et appliqué
 * à l'identique par les moteurs PostgreSQL et OpenSearch.
 *
 * score = Σ poidsᵢ × composanteᵢ / Σ poids des composantes actives, chaque
 * composante valant entre 0 et 1 :
 * - text      : rang plein texte (ts_rank_cd normalisé) ou similarité trigramme ;
 * - location  : proximité au point de recherche (1 au centre, 0 au bord du rayon) ;
 * - freshness : 1 / (1 + âge en jours / FRESHNESS_HALF_LIFE_DAYS) ;
 * - quality   : complétude de l'annonce calculée à l'indexation.
 *
 * Une composante sans objet (pas de texte, pas de point) est retirée et les
 * poids restants sont renormalisés. Aucun signal utilisateur n'intervient :
 * la personnalisation relève du module Recommendation.
 */
export const SEARCH_SCORE_WEIGHTS = {
  text: 0.5,
  location: 0.2,
  freshness: 0.15,
  quality: 0.15,
} as const

export type ScoreComponent = keyof typeof SEARCH_SCORE_WEIGHTS

/** Âge (jours) auquel la fraîcheur vaut 0,5. */
export const FRESHNESS_HALF_LIFE_DAYS = 30

/** Poids ts_rank_cd des classes D, C, B, A (équipements → titre/type/lieu). */
export const TS_RANK_WEIGHTS = [0.1, 0.2, 0.4, 1.0] as const

export function activeWeights(active: {
  text: boolean
  location: boolean
}): Record<ScoreComponent, number> {
  const raw = {
    text: active.text ? SEARCH_SCORE_WEIGHTS.text : 0,
    location: active.location ? SEARCH_SCORE_WEIGHTS.location : 0,
    freshness: SEARCH_SCORE_WEIGHTS.freshness,
    quality: SEARCH_SCORE_WEIGHTS.quality,
  }
  const total = raw.text + raw.location + raw.freshness + raw.quality
  return {
    text: raw.text / total,
    location: raw.location / total,
    freshness: raw.freshness / total,
    quality: raw.quality / total,
  }
}

export function freshness(ageDays: number): number {
  return 1 / (1 + Math.max(0, ageDays) / FRESHNESS_HALF_LIFE_DAYS)
}

/** Version TypeScript du score, de référence pour les tests et OpenSearch. */
export function combineScore(
  components: Partial<Record<ScoreComponent, number>>,
  active: { text: boolean; location: boolean },
): number {
  const weights = activeWeights(active)
  return (Object.keys(weights) as ScoreComponent[]).reduce(
    (sum, key) =>
      sum + weights[key] * Math.min(1, Math.max(0, components[key] ?? 0)),
    0,
  )
}
