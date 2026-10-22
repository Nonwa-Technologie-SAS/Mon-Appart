import type { ListingType } from "./index"

/** Contrat public de `GET /api/v1/search`, partagé avec les frontends. */
export const SEARCH_SORTS = [
  "RELEVANCE",
  "NEWEST",
  "PRICE_ASC",
  "PRICE_DESC",
  "SURFACE_ASC",
  "SURFACE_DESC",
  "DISTANCE",
] as const

export type SearchSort = (typeof SEARCH_SORTS)[number]

export const SEARCH_FACETS = [
  "propertyTypes",
  "listingTypes",
  "cities",
  "communes",
  "neighborhoods",
  "priceRanges",
  "bedrooms",
  "amenities",
] as const

export type SearchFacetName = (typeof SEARCH_FACETS)[number]

export type AmenitiesMode = "AND" | "OR"

export type SearchEngineName = "postgres" | "opensearch"

/**
 * `exact` : compte complet ; `estimated` : au moins `value` (plafond atteint) ;
 * `not_available` : non calculé (pages suivantes).
 */
export type SearchTotalStrategy = "exact" | "estimated" | "not_available"

export interface CodeName {
  code: string
  name: string
}

export interface SearchResultLocation {
  city: CodeName
  commune: CodeName
  neighborhood: CodeName
  /** Position publiée : arrondie (APPROXIMATE) ou absente (HIDDEN). */
  latitude: number | null
  longitude: number | null
  precision: "EXACT" | "APPROXIMATE" | "NONE"
}

export interface SearchDistance {
  value: number
  unit: "km"
}

export interface SearchResultItem {
  listingId: string
  propertyId: string
  title: string
  listingType: ListingType
  propertyType: CodeName
  price: { amount: number; currency: string; period: string } | null
  surface: number | null
  landSurface: number | null
  bedrooms: number | null
  bathrooms: number | null
  location: SearchResultLocation
  mainImage: string | null
  /** 0..1, présent uniquement en tri RELEVANCE. */
  score: number | null
  /** Présent uniquement en recherche géographique. */
  distance: SearchDistance | null
  publishedAt: string
}

export interface FacetBucket {
  value: string
  label: string
  count: number
}

export interface PriceRangeBucket {
  min: number | null
  max: number | null
  count: number
}

export interface SearchFacets {
  propertyTypes?: FacetBucket[]
  listingTypes?: FacetBucket[]
  cities?: FacetBucket[]
  communes?: FacetBucket[]
  neighborhoods?: FacetBucket[]
  priceRanges?: PriceRangeBucket[]
  bedrooms?: FacetBucket[]
  amenities?: FacetBucket[]
}

export interface RelaxedFilterSuggestion {
  /** Filtre à assouplir, ex. `neighborhood`, `maxPrice`, `amenities`. */
  filter: string
  /** Paramètres de requête proposés (à fusionner dans l'URL courante). */
  params: Record<string, string | null>
  label: string
}

export interface SearchZeroResults {
  suggestions: string[]
  relaxedFilters: RelaxedFilterSuggestion[]
}

export interface SearchResponse {
  items: SearchResultItem[]
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number }
  total: { value: number | null; strategy: SearchTotalStrategy }
  facets?: SearchFacets
  meta: {
    sort: SearchSort
    engine: SearchEngineName
    /** Vrai si le moteur configuré a échoué et que PostgreSQL a répondu. */
    degraded: boolean
    /** Vrai si la recherche plein texte stricte était vide et que la tolérance aux fautes a été appliquée. */
    fuzzy: boolean
  }
  zeroResults?: SearchZeroResults
}

export const SUGGESTION_TYPES = [
  "CITY",
  "LOCATION",
  "NEIGHBORHOOD",
  "PROPERTY_TYPE",
  "QUERY",
] as const

export type SuggestionType = (typeof SUGGESTION_TYPES)[number]

export interface Suggestion {
  type: SuggestionType
  label: string
  /** Paramètres de recherche à appliquer si la suggestion est choisie. */
  params: Record<string, string>
}

export interface SuggestionResponse {
  items: Suggestion[]
}

/** Contrat préparé pour `GET /search/map` (pas encore exposé, pas de clustering). */
export interface SearchMapMarker {
  listingId: string
  latitude: number
  longitude: number
  precision: "EXACT" | "APPROXIMATE"
  price: { amount: number; currency: string } | null
}

/** Contrat préparé : recherches sauvegardées (sans alerte pour l'instant). */
export interface SavedSearchContract {
  id: string
  name: string
  params: Record<string, string>
  createdAt: string
}
