/**
 * Correspondance déterministe d'une annonce à une recherche sauvegardée.
 * Une annonce au-dessus du budget n'est jamais classée « exacte ».
 */

export const NEAR_BUDGET_RATIO = 0.15

export const SAVED_SEARCH_PARAM_KEYS = [
  "q",
  "listingType",
  "propertyType",
  "city",
  "commune",
  "neighborhood",
  "lat",
  "lng",
  "radius",
  "minPrice",
  "maxPrice",
  "minSurface",
  "maxSurface",
  "minLandSurface",
  "maxLandSurface",
  "bedrooms",
  "maxBedrooms",
  "bathrooms",
  "amenities",
  "amenitiesMode",
] as const

export type SavedSearchParamKey = (typeof SAVED_SEARCH_PARAM_KEYS)[number]

export type ListingMatchInput = {
  status: string
  deletedAt: Date | null
  expiresAt: Date | null
  publishedAt: Date | null
  listingType: string
  propertyTypeCode: string | null
  cityCode: string | null
  communeCode: string | null
  neighborhoodCode: string | null
  priceAmount: number | null
  bedrooms: number | null
  bathrooms: number | null
  surface: number | null
  now?: Date
}

export type SavedSearchCriteria = {
  listingTypes: readonly string[]
  propertyTypes: readonly string[]
  cities: readonly string[]
  communes: readonly string[]
  neighborhoods: readonly string[]
  minPrice: number | null
  maxPrice: number | null
  minSurface: number | null
  maxSurface: number | null
  minBedrooms: number | null
  minBathrooms: number | null
}

export type MatchKind = "ineligible" | "mismatch" | "exact" | "near_budget"

export type ListingMatchResult = {
  kind: MatchKind
  /** Écart de prix au-dessus du maximum déclaré, si `near_budget`. */
  overBudgetAmount: number | null
}

const PARAM_KEY_SET = new Set<string>(SAVED_SEARCH_PARAM_KEYS)

export function sanitizeSavedSearchParams(
  raw: Record<string, unknown>,
): Record<string, string> {
  const params: Record<string, string> = {}
  for (const key of SAVED_SEARCH_PARAM_KEYS) {
    const value = raw[key]
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (!trimmed) continue
    params[key] = trimmed.slice(0, 500)
  }
  return params
}

export function isSavedSearchParamKey(key: string): key is SavedSearchParamKey {
  return PARAM_KEY_SET.has(key)
}

export function hasAlertableCriteria(criteria: SavedSearchCriteria): boolean {
  return (
    criteria.listingTypes.length > 0 ||
    criteria.propertyTypes.length > 0 ||
    criteria.cities.length > 0 ||
    criteria.communes.length > 0 ||
    criteria.neighborhoods.length > 0 ||
    criteria.minPrice !== null ||
    criteria.maxPrice !== null ||
    criteria.minSurface !== null ||
    criteria.maxSurface !== null ||
    criteria.minBedrooms !== null ||
    criteria.minBathrooms !== null
  )
}

function inList(value: string | null, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true
  if (!value) return false
  return allowed.includes(value)
}

function inRange(
  value: number | null,
  min: number | null,
  max: number | null,
): boolean {
  if (min === null && max === null) return true
  if (value === null) return false
  if (min !== null && value < min) return false
  if (max !== null && value > max) return false
  return true
}

export function matchListingToSavedSearch(
  listing: ListingMatchInput,
  criteria: SavedSearchCriteria,
): ListingMatchResult {
  const now = listing.now ?? new Date()
  const expired =
    listing.expiresAt !== null && listing.expiresAt.getTime() <= now.getTime()
  if (
    listing.status !== "PUBLISHED" ||
    listing.deletedAt !== null ||
    expired ||
    listing.publishedAt === null
  ) {
    return { kind: "ineligible", overBudgetAmount: null }
  }

  if (
    criteria.listingTypes.length > 0 &&
    !criteria.listingTypes.includes(listing.listingType)
  ) {
    return { kind: "mismatch", overBudgetAmount: null }
  }
  if (!inList(listing.propertyTypeCode, criteria.propertyTypes)) {
    return { kind: "mismatch", overBudgetAmount: null }
  }
  if (criteria.neighborhoods.length > 0) {
    if (!inList(listing.neighborhoodCode, criteria.neighborhoods)) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
  } else if (criteria.communes.length > 0) {
    if (!inList(listing.communeCode, criteria.communes)) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
  } else if (criteria.cities.length > 0) {
    if (!inList(listing.cityCode, criteria.cities)) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
  }

  if (criteria.minBedrooms !== null) {
    if (listing.bedrooms === null || listing.bedrooms < criteria.minBedrooms) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
  }
  if (criteria.minBathrooms !== null) {
    if (
      listing.bathrooms === null ||
      listing.bathrooms < criteria.minBathrooms
    ) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
  }
  if (!inRange(listing.surface, criteria.minSurface, criteria.maxSurface)) {
    return { kind: "mismatch", overBudgetAmount: null }
  }

  if (criteria.minPrice !== null || criteria.maxPrice !== null) {
    if (listing.priceAmount === null) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
    if (criteria.minPrice !== null && listing.priceAmount < criteria.minPrice) {
      return { kind: "mismatch", overBudgetAmount: null }
    }
    if (criteria.maxPrice !== null && listing.priceAmount > criteria.maxPrice) {
      const ceiling = criteria.maxPrice * (1 + NEAR_BUDGET_RATIO)
      if (listing.priceAmount <= ceiling) {
        return {
          kind: "near_budget",
          overBudgetAmount: listing.priceAmount - criteria.maxPrice,
        }
      }
      return { kind: "mismatch", overBudgetAmount: null }
    }
  }

  return { kind: "exact", overBudgetAmount: null }
}

export function digestDedupKey(
  savedSearchPublicId: string,
  periodStartIso: string,
): string {
  return `saved-search:${savedSearchPublicId}:digest:${periodStartIso}`
}

export function priceDropDedupKey(
  listingPublicId: string,
  validFromIso: string,
): string {
  return `price-drop:${listingPublicId}:${validFromIso}`
}

export function unavailableDedupKey(listingPublicId: string): string {
  return `listing-unavailable:${listingPublicId}`
}
