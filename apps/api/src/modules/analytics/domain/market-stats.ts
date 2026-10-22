/**
 * Agrégats offre / prix pour le dashboard marché.
 * Les prix sont ceux des annonces publiées — pas des transactions conclues.
 */

export interface SupplyBucket {
  commune: string
  listingType: string
  propertyType: string
  period: string
  listings: number
  median: number | null
  p25: number | null
  p75: number | null
}

export interface MarketSnapshot {
  activeListings: number
  distinctProperties: number
  byListingType: Array<{ value: string; count: number }>
  byCommune: Array<{ value: string; count: number }>
  priceBuckets: SupplyBucket[]
  suppressedGroups: number
  disclaimer: string
}

/** Regroupe les buckets trop petits sous OTHER (k-anonymat). */
export function applySupplyThreshold(
  buckets: readonly SupplyBucket[],
  minSize: number,
): { kept: SupplyBucket[]; suppressedGroups: number } {
  const kept: SupplyBucket[] = []
  let suppressedGroups = 0
  const otherByKey = new Map<string, SupplyBucket>()

  for (const bucket of buckets) {
    if (bucket.listings >= minSize) {
      kept.push(bucket)
      continue
    }
    suppressedGroups += 1
    const key = `${bucket.listingType}|${bucket.period}`
    const existing = otherByKey.get(key)
    if (!existing) {
      otherByKey.set(key, {
        commune: "OTHER",
        listingType: bucket.listingType,
        propertyType: "OTHER",
        period: bucket.period,
        listings: bucket.listings,
        median: null,
        p25: null,
        p75: null,
      })
    } else {
      existing.listings += bucket.listings
    }
  }

  for (const other of otherByKey.values()) {
    if (other.listings >= minSize) kept.push(other)
  }

  kept.sort((a, b) => b.listings - a.listings)
  return { kept, suppressedGroups }
}

/** Percentile sur liste déjà triée croissante. */
export function percentileSorted(
  sorted: readonly number[],
  p: number,
): number | null {
  if (sorted.length === 0) return null
  if (p <= 0) return sorted[0]!
  if (p >= 1) return sorted[sorted.length - 1]!
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]!
  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}
