import type { RawSearchParams } from "../../search/domain/search-query"
import type { AssistantCriteria } from "./assistant-criteria"

/**
 * Convertit des critères validés en paramètres Search existants.
 * N’applique pas de soft preferences comme filtres stricts.
 */
export function criteriaToSearchParams(
  criteria: AssistantCriteria,
  limit = 12,
): RawSearchParams {
  const params: RawSearchParams = {
    limit: String(limit),
    sort: "NEWEST",
    submit: "false",
  }

  if (criteria.listingTypes.length) {
    params.listingType = criteria.listingTypes.join(",")
  }
  if (criteria.propertyTypes.length) {
    params.propertyType = criteria.propertyTypes.join(",")
  }
  if (criteria.cities.length) {
    params.city = criteria.cities.join(",")
  }
  if (criteria.communes.length) {
    params.commune = criteria.communes.join(",")
  }
  if (criteria.neighborhoods.length) {
    params.neighborhood = criteria.neighborhoods.join(",")
  }
  if (criteria.priceMin != null) {
    params.minPrice = String(criteria.priceMin)
  }
  if (criteria.priceMax != null) {
    params.maxPrice = String(criteria.priceMax)
  }
  if (criteria.bedroomsMin != null) {
    params.bedrooms = String(criteria.bedroomsMin)
  }
  if (criteria.bathroomsMin != null) {
    params.bathrooms = String(criteria.bathroomsMin)
  }
  if (criteria.surfaceMin != null) {
    params.minSurface = String(criteria.surfaceMin)
  }
  if (criteria.surfaceMax != null) {
    params.maxSurface = String(criteria.surfaceMax)
  }
  if (criteria.amenities.length) {
    params.amenities = criteria.amenities.join(",")
    params.amenitiesMode = "AND"
  }
  if (criteria.freeText && !criteria.communes.length && !criteria.neighborhoods.length) {
    params.q = criteria.freeText
  }

  // Équipements suggérés par soft prefs sans forcer un filtre faux.
  if (
    criteria.softPreferences.includes("OUTDOOR_SPACE") &&
    !criteria.amenities.includes("GARDEN")
  ) {
    // pas de filtre inventé
  }

  return params
}

export function searchParamsAsRecord(
  params: RawSearchParams,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) out[key] = value
  }
  return out
}
