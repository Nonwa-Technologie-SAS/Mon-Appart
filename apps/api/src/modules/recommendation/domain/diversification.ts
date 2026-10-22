import type {
  DiversityOptions,
  ListingCandidate,
  RankedRecommendation,
} from "./recommendation-input"
import { compareRanked } from "./scoring"

/** Prix considérés comme identiques en dessous de cet écart relatif. */
const NEAR_PRICE = 0.05
const CLOSE_PRICE = 0.1

/**
 * Similarité 0..1 entre deux annonces, du point de vue de l'utilisateur :
 * même bien = 1 ; même publieur, même quartier, même type et prix voisins
 * = quasi-doublon (1) ; sinon somme pondérée des points communs.
 */
export function listingSimilarity(
  a: ListingCandidate,
  b: ListingCandidate,
): number {
  if (a.propertyId === b.propertyId) return 1
  const sameOwner = a.createdById === b.createdById
  const sameNeighborhood = a.neighborhoodId === b.neighborhoodId
  const sameType = a.propertyTypeId === b.propertyTypeId
  const gap = relativeGap(a.price.amount, b.price.amount)
  if (
    sameOwner &&
    sameNeighborhood &&
    sameType &&
    gap <= NEAR_PRICE &&
    a.bedrooms === b.bedrooms
  ) {
    return 1
  }
  return Math.min(
    1,
    (sameOwner ? 0.5 : 0) +
      (sameNeighborhood ? 0.25 : 0) +
      (sameType ? 0.15 : 0) +
      (gap <= CLOSE_PRICE ? 0.1 : 0),
  )
}

/**
 * Réordonne une liste déjà filtrée (MMR glouton) : à chaque rang, l'annonce
 * qui maximise `score − λ × similarité maximale avec les annonces retenues`.
 * Un même bien n'apparaît qu'une fois ; au-delà de `maxPerOwner` annonces
 * d'un publieur, les suivantes passent en fin de liste. Ne retire jamais
 * une annonce pour un autre motif : les filtres stricts restent ceux du pool.
 */
export function diversify(
  ranked: readonly RankedRecommendation[],
  limit: number,
  options: DiversityOptions,
): RankedRecommendation[] {
  const ordered = [...ranked].sort(compareRanked)
  const seenProperties = new Set<bigint>()
  const unique = ordered.filter((item) => {
    if (seenProperties.has(item.candidate.propertyId)) return false
    seenProperties.add(item.candidate.propertyId)
    return true
  })
  if (!options.enabled || unique.length <= 1) return unique.slice(0, limit)

  const selected: RankedRecommendation[] = []
  const deferred: RankedRecommendation[] = []
  const perOwner = new Map<bigint, number>()
  const remaining = [...unique]
  const maxSimilarity = new Array<number>(remaining.length).fill(0)

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = -1
    let bestValue = Number.NEGATIVE_INFINITY
    for (let index = 0; index < remaining.length; index += 1) {
      const owner = remaining[index]!.candidate.createdById
      if ((perOwner.get(owner) ?? 0) >= options.maxPerOwner) continue
      const value =
        remaining[index]!.score - options.lambda * maxSimilarity[index]!
      if (value > bestValue) {
        bestValue = value
        bestIndex = index
      }
    }
    if (bestIndex === -1) break
    const [picked] = remaining.splice(bestIndex, 1)
    maxSimilarity.splice(bestIndex, 1)
    selected.push(picked!)
    const owner = picked!.candidate.createdById
    perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1)
    for (let index = 0; index < remaining.length; index += 1) {
      maxSimilarity[index] = Math.max(
        maxSimilarity[index]!,
        listingSimilarity(picked!.candidate, remaining[index]!.candidate),
      )
    }
  }
  // Publieurs au plafond : proposés seulement s'il reste de la place.
  deferred.push(...remaining)
  return [...selected, ...deferred].slice(0, limit)
}

function relativeGap(a: number, b: number): number {
  const base = Math.max(a, b)
  return base <= 0 ? 0 : Math.abs(a - b) / base
}
