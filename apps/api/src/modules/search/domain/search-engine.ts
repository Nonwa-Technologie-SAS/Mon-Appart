import type {
  DependencyCheck,
  SearchEngineName,
  SearchTotalStrategy,
  Suggestion,
} from "@mon-appart/types"

import type { SearchCursor } from "./search-cursor"
import type { SearchQuery } from "./search-query"

/** Recherche validée dont les codes de référentiel sont résolus. */
export interface ResolvedSearch {
  query: SearchQuery
  cursor: SearchCursor | null
  /** Instant de référence de la fraîcheur, constant sur toutes les pages. */
  asOf: Date
  /** Empreinte des filtres, recopiée dans le curseur. */
  fingerprint: string
  /** `null` : pas de filtre de lieu ; tableau vide : aucun lieu ne correspond. */
  neighborhoodIds: number[] | null
  propertyTypeIds: number[]
  amenityIds: number[]
  /** Recherche plein texte tolérante aux fautes (trigrammes). */
  fuzzy: boolean
}

export interface EngineHit {
  /** Identifiant public de l'annonce. */
  listingId: string
  /** Valeur de tri du résultat, recopiée dans le curseur. */
  sortKey: string | null
  score: number | null
  distanceMeters: number | null
}

/** Comptes bruts ; les libellés et l'agrégation ville/commune sont faits ensuite. */
export interface RawFacetCounts {
  propertyTypes?: Map<string, number>
  listingTypes?: Map<string, number>
  neighborhoods?: Map<number, number>
  bedrooms?: Map<number, number>
  amenities?: Map<string, number>
  /** Un compte par tranche, dans l'ordre des bornes configurées (n bornes → n+1 tranches). */
  priceRanges?: number[]
}

export interface EngineSearchResult {
  hits: EngineHit[]
  hasMore: boolean
  total: { value: number | null; strategy: SearchTotalStrategy }
  facets: RawFacetCounts | null
}

export interface SuggestInput {
  normalized: string
  limit: number
}

/**
 * Port de recherche. PostgreSQL l'implémente toujours ; OpenSearch est une
 * implémentation optionnelle. Les deux renvoient des identifiants : la
 * construction des résultats relit toujours PostgreSQL (source de vérité).
 */
export interface SearchEngine {
  readonly name: SearchEngineName
  search(request: ResolvedSearch): Promise<EngineSearchResult>
  suggest(input: SuggestInput): Promise<Suggestion[]>
  health(): Promise<DependencyCheck>
}

/** Plafond du comptage : au-delà, le total est signalé `estimated`. */
export const TOTAL_COUNT_CAP = 1_000
/** Nombre maximal de lignes agrégées pour les facettes. */
export const FACET_SAMPLE_CAP = 5_000
