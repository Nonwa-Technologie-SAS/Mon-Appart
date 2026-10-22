import {
  LISTING_TYPES,
  SEARCH_FACETS,
  SEARCH_SORTS,
  type AmenitiesMode,
  type ListingType,
  type SearchFacetName,
  type SearchSort,
} from "@mon-appart/types"

import { searchError, SearchErrorCode } from "./search-errors"
import {
  MAX_QUERY_LENGTH,
  normalizeCode,
  normalizeText,
  tokenize,
} from "./text-normalizer"

/** Paramètres bruts de `GET /search`, tels que reçus dans l'URL. */
export interface RawSearchParams {
  q?: string
  listingType?: string
  propertyType?: string
  city?: string
  commune?: string
  neighborhood?: string
  lat?: string
  lng?: string
  radius?: string
  minPrice?: string
  maxPrice?: string
  minSurface?: string
  maxSurface?: string
  minLandSurface?: string
  maxLandSurface?: string
  bedrooms?: string
  maxBedrooms?: string
  bathrooms?: string
  amenities?: string
  amenitiesMode?: string
  sort?: string
  cursor?: string
  limit?: string
  facets?: string
  submit?: string
}

export interface SearchLimits {
  defaultLimit: number
  maxLimit: number
  maxRadiusKm: number
}

export interface NumericRange {
  min: number | null
  max: number | null
}

export interface SearchText {
  /** Texte normalisé (minuscules, sans accents), pour les trigrammes et l'historique. */
  normalized: string
  tokens: string[]
}

export interface GeoFilter {
  latitude: number
  longitude: number
  radiusKm: number
}

/** Objet valeur immuable : une recherche validée, indépendante du moteur. */
export interface SearchQuery {
  text: SearchText | null
  listingTypes: ListingType[]
  propertyTypes: string[]
  cities: string[]
  communes: string[]
  neighborhoods: string[]
  geo: GeoFilter | null
  price: NumericRange
  surface: NumericRange
  landSurface: NumericRange
  /** `bedrooms=N` signifie au moins N chambres. */
  bedrooms: NumericRange
  /** `bathrooms=N` signifie au moins N salles de bain. */
  bathrooms: NumericRange
  amenities: string[]
  amenitiesMode: AmenitiesMode
  sort: SearchSort
  limit: number
  facets: SearchFacetName[]
  cursor: string | null
  /** Recherche validée par l'utilisateur (bouton) : seule celle-ci est historisée. */
  submit: boolean
}

/** Rayon appliqué si des coordonnées sont fournies sans `radius`. */
export const DEFAULT_RADIUS_KM = 10
const MAX_LIST_VALUES = 20
/** Bornes alignées sur les colonnes NUMERIC(14,2) et (10,2) de `searches`. */
const MAX_PRICE = 999_999_999_999
const MAX_SURFACE = 99_999_999
const MAX_ROOMS = 50

const invalid = (detail: string) =>
  searchError(SearchErrorCode.INVALID_SEARCH_QUERY, detail)

function list(value: string | undefined, name: string): string[] {
  if (value === undefined) return []
  const items = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
  if (items.length > MAX_LIST_VALUES) throw invalid(`${name} : trop de valeurs`)
  return items
}

function codes(value: string | undefined, name: string): string[] {
  const items = list(value, name).map(normalizeCode).filter(Boolean)
  return [...new Set(items)]
}

function number(
  value: string | undefined,
  code: SearchErrorCode,
  name: string,
  max: number,
): number | null {
  if (value === undefined || value.trim() === "") return null
  if (!/^\d+(\.\d+)?$/.test(value.trim())) throw searchError(code, name)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed > max) throw searchError(code, name)
  return parsed
}

function range(
  min: string | undefined,
  max: string | undefined,
  code: SearchErrorCode,
  names: [string, string],
  limit: number,
): NumericRange {
  const result = {
    min: number(min, code, names[0], limit),
    max: number(max, code, names[1], limit),
  }
  if (result.min !== null && result.max !== null && result.min > result.max) {
    throw searchError(code, `${names[0]} > ${names[1]}`)
  }
  return result
}

function integerRange(
  min: string | undefined,
  max: string | undefined,
  names: [string, string],
): NumericRange {
  const result = range(
    min,
    max,
    SearchErrorCode.INVALID_SEARCH_QUERY,
    names,
    MAX_ROOMS,
  )
  for (const value of [result.min, result.max]) {
    if (value !== null && !Number.isInteger(value)) {
      throw invalid(names.join("/"))
    }
  }
  return result
}

function coordinate(
  value: string | undefined,
  bound: number,
  name: string,
): number | null {
  if (value === undefined || value.trim() === "") return null
  if (!/^-?\d{1,3}(\.\d{1,8})?$/.test(value.trim())) {
    throw searchError(SearchErrorCode.INVALID_GEO_COORDINATES, name)
  }
  const parsed = Number(value)
  if (Math.abs(parsed) > bound) {
    throw searchError(SearchErrorCode.INVALID_GEO_COORDINATES, name)
  }
  return parsed
}

function geo(params: RawSearchParams, maxRadiusKm: number): GeoFilter | null {
  const latitude = coordinate(params.lat, 90, "lat")
  const longitude = coordinate(params.lng, 180, "lng")
  const hasRadius = params.radius !== undefined && params.radius.trim() !== ""
  if (latitude === null && longitude === null) {
    if (hasRadius)
      throw searchError(SearchErrorCode.INVALID_RADIUS, "lat/lng requis")
    return null
  }
  if (latitude === null || longitude === null) {
    throw searchError(SearchErrorCode.INVALID_GEO_COORDINATES, "lat et lng")
  }
  let radiusKm = Math.min(DEFAULT_RADIUS_KM, maxRadiusKm)
  if (hasRadius) {
    const raw = params.radius!.trim()
    const parsed = /^\d+(\.\d{1,3})?$/.test(raw) ? Number(raw) : Number.NaN
    if (!(parsed > 0) || parsed > maxRadiusKm) {
      throw searchError(
        SearchErrorCode.INVALID_RADIUS,
        `entre 0 et ${maxRadiusKm} km`,
      )
    }
    radiusKm = parsed
  }
  return { latitude, longitude, radiusKm }
}

function text(q: string | undefined): SearchText | null {
  if (q === undefined) return null
  const normalized = normalizeText(q)
  if (normalized.length > MAX_QUERY_LENGTH) {
    throw invalid(`q : ${MAX_QUERY_LENGTH} caractères maximum`)
  }
  const tokens = tokenize(normalized)
  return tokens.length === 0 ? null : { normalized, tokens }
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
): T | null {
  if (value === undefined || value.trim() === "") return null
  const upper = value.trim().toUpperCase()
  const match = allowed.find((item) => item === upper)
  if (!match) throw invalid(name)
  return match
}

function limit(value: string | undefined, limits: SearchLimits): number {
  if (value === undefined || value.trim() === "") return limits.defaultLimit
  const parsed = /^\d{1,4}$/.test(value.trim()) ? Number(value) : Number.NaN
  if (!(parsed >= 1) || parsed > limits.maxLimit) {
    throw invalid(`limit : entre 1 et ${limits.maxLimit}`)
  }
  return parsed
}

/**
 * Valide et normalise les paramètres d'URL. Toute entrée invalide lève une
 * erreur au code précis ; rien de brut n'est transmis aux moteurs.
 * Les codes de lieux et de types sont normalisés (casse, accents) mais leur
 * existence est vérifiée plus tard contre le référentiel.
 */
export function parseSearchQuery(
  params: RawSearchParams,
  limits: SearchLimits,
): SearchQuery {
  const searchText = text(params.q)
  const geoFilter = geo(params, limits.maxRadiusKm)

  const listingTypes = list(params.listingType, "listingType").map((value) => {
    const match = oneOf(value, LISTING_TYPES, "listingType")
    if (!match) throw invalid("listingType")
    return match
  })

  const facets = list(params.facets, "facets").map((value) => {
    const match = SEARCH_FACETS.find((facet) => facet === value)
    if (!match) throw invalid("facets")
    return match
  })

  const requestedSort = oneOf(params.sort, SEARCH_SORTS, "sort")
  const sort: SearchSort =
    requestedSort ?? (searchText ? "RELEVANCE" : "NEWEST")
  if (sort === "DISTANCE" && !geoFilter) {
    throw invalid("sort=DISTANCE exige lat et lng")
  }

  const amenitiesMode =
    oneOf<AmenitiesMode>(
      params.amenitiesMode,
      ["AND", "OR"],
      "amenitiesMode",
    ) ?? "AND"

  const submit = params.submit?.trim().toLowerCase()
  if (submit !== undefined && submit !== "true" && submit !== "false") {
    throw invalid("submit")
  }

  const cursor = params.cursor?.trim() || null
  if (cursor !== null && cursor.length > 512) {
    throw searchError(SearchErrorCode.INVALID_CURSOR)
  }

  return {
    text: searchText,
    listingTypes: [...new Set(listingTypes)],
    propertyTypes: codes(params.propertyType, "propertyType"),
    cities: codes(params.city, "city"),
    communes: codes(params.commune, "commune"),
    neighborhoods: codes(params.neighborhood, "neighborhood"),
    geo: geoFilter,
    price: range(
      params.minPrice,
      params.maxPrice,
      SearchErrorCode.INVALID_PRICE_RANGE,
      ["minPrice", "maxPrice"],
      MAX_PRICE,
    ),
    surface: range(
      params.minSurface,
      params.maxSurface,
      SearchErrorCode.INVALID_SURFACE_RANGE,
      ["minSurface", "maxSurface"],
      MAX_SURFACE,
    ),
    landSurface: range(
      params.minLandSurface,
      params.maxLandSurface,
      SearchErrorCode.INVALID_SURFACE_RANGE,
      ["minLandSurface", "maxLandSurface"],
      MAX_SURFACE,
    ),
    bedrooms: integerRange(params.bedrooms, params.maxBedrooms, [
      "bedrooms",
      "maxBedrooms",
    ]),
    bathrooms: integerRange(params.bathrooms, undefined, [
      "bathrooms",
      "bathrooms",
    ]),
    amenities: codes(params.amenities, "amenities"),
    amenitiesMode,
    sort,
    limit: limit(params.limit, limits),
    facets: [...new Set(facets)],
    cursor,
    submit: submit === "true",
  }
}

/** Vrai si la requête porte au moins un filtre structuré (hors tri et pagination). */
export function hasStructuredFilters(query: SearchQuery): boolean {
  return (
    query.listingTypes.length > 0 ||
    query.propertyTypes.length > 0 ||
    query.cities.length > 0 ||
    query.communes.length > 0 ||
    query.neighborhoods.length > 0 ||
    query.geo !== null ||
    query.amenities.length > 0 ||
    [
      query.price,
      query.surface,
      query.landSurface,
      query.bedrooms,
      query.bathrooms,
    ].some((r) => r.min !== null || r.max !== null)
  )
}
