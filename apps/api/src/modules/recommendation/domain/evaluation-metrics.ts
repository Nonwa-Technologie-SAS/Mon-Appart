/**
 * Métriques de classement hors ligne (jeux de test reproductibles).
 * Ne confondent pas clics et qualité métier — purement positionnels.
 */

export interface RankedId {
  id: string
  /** Pertinence binaire ou graduée (0..1) pour NDCG. */
  relevance: number
}

/** Precision@K : part des K premiers jugés pertinents (relevance > 0). */
export function precisionAtK(
  ranked: readonly RankedId[],
  k: number,
): number {
  if (k <= 0) return 0
  const slice = ranked.slice(0, k)
  if (slice.length === 0) return 0
  const hits = slice.filter((item) => item.relevance > 0).length
  return hits / slice.length
}

/** Recall@K : part des items pertinents du catalogue présents dans le top K. */
export function recallAtK(
  ranked: readonly RankedId[],
  relevantIds: ReadonlySet<string>,
  k: number,
): number {
  if (relevantIds.size === 0 || k <= 0) return 0
  const slice = ranked.slice(0, k)
  let hits = 0
  for (const item of slice) {
    if (relevantIds.has(item.id)) hits += 1
  }
  return hits / relevantIds.size
}

function dcg(relevances: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < relevances.length; i += 1) {
    const rel = relevances[i]!
    sum += (2 ** rel - 1) / Math.log2(i + 2)
  }
  return sum
}

/** NDCG@K avec pertinence graduée (0..n). */
export function ndcgAtK(ranked: readonly RankedId[], k: number): number {
  if (k <= 0) return 0
  const slice = ranked.slice(0, k)
  if (slice.length === 0) return 0
  const gains = slice.map((item) => item.relevance)
  const ideal = [...gains].sort((a, b) => b - a)
  const idealDcg = dcg(ideal)
  if (idealDcg === 0) return 0
  return dcg(gains) / idealDcg
}

/**
 * Couverture : part d’un catalogue candidat apparaissant au moins une fois
 * dans les listes servies (agrégat hors ligne).
 */
export function catalogCoverage(
  servedIds: readonly string[],
  catalogIds: ReadonlySet<string>,
): number {
  if (catalogIds.size === 0) return 0
  const unique = new Set(servedIds.filter((id) => catalogIds.has(id)))
  return unique.size / catalogIds.size
}

/**
 * Diversité simple : 1 − (max fréquence d’une clé / n).
 * Clé = commune, type, etc.
 */
export function attributeDiversity(
  attributes: readonly string[],
): number {
  if (attributes.length === 0) return 0
  const counts = new Map<string, number>()
  for (const value of attributes) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let max = 0
  for (const count of counts.values()) max = Math.max(max, count)
  return 1 - max / attributes.length
}
