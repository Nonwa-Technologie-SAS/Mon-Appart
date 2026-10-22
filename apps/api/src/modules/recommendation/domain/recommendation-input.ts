import type { RecommendationDimension } from "@mon-appart/config"
import type {
  ListingType,
  RecommendationContext,
  RecommendationLevel,
  RecommendationReasonCode,
} from "@mon-appart/types"

import type { PropertyCategory } from "../../../generated/prisma/enums"
import type { ListingCandidate } from "../../search"
import type { Budget } from "./budget"

export type { ListingCandidate }

/** Poids en points par dimension (somme 100, validée au démarrage). */
export type RecommendationWeights = Record<RecommendationDimension, number>

/** Préférences déclarées, codes résolus en identifiants internes. */
export interface DeclaredPreferences {
  listingTypes: ListingType[]
  budget: Budget | null
  propertyTypeIds: number[]
  /** Catégories des types préférés : correspondance partielle. */
  propertyCategories: PropertyCategory[]
  neighborhoodIds: number[]
  communeIds: number[]
  /** Communes des quartiers préférés : voisinage proche. */
  nearbyCommuneIds: number[]
  /** Villes des lieux préférés. */
  cityIds: number[]
  amenityCodes: string[]
  bedrooms: number | null
  bathrooms: number | null
  surface: { min: number | null; max: number | null }
  point: { latitude: number; longitude: number; radiusMeters: number } | null
}

/** Poids 0..1 déduits de l'activité (clé : identifiant interne ou code). */
export interface BehaviorSignals {
  neighborhoods: Record<string, number>
  communes: Record<string, number>
  propertyTypes: Record<string, number>
  amenities: Record<string, number>
}

export interface ScoringContext {
  mode: RecommendationContext
  weights: RecommendationWeights
  preferences: DeclaredPreferences | null
  behavior: BehaviorSignals | null
  /** Annonce de référence (mode SIMILAR). */
  reference: ListingCandidate | null
  /** Biens déjà consultés (identifiant interne) : légère pénalité. */
  viewedPropertyIds: ReadonlySet<bigint>
  asOf: Date
}

export interface DiversityOptions {
  enabled: boolean
  /** 0 : pertinence seule ; 1 : diversité maximale. */
  lambda: number
  maxPerOwner: number
}

export interface RankingInput {
  context: ScoringContext
  candidates: ListingCandidate[]
  limit: number
  diversity: DiversityOptions
}

export type ScoreComponents = Partial<Record<RecommendationDimension, number>>

export interface RankedRecommendation {
  candidate: ListingCandidate
  /** 0..1 */
  score: number
  components: ScoreComponents
  reasons: RecommendationReasonCode[]
}

/** Signaux disponibles → niveau de personnalisation annoncé. */
export function recommendationLevel(
  preferences: DeclaredPreferences | null,
  behavior: BehaviorSignals | null,
): RecommendationLevel {
  if (behavior && !isEmptyBehavior(behavior)) return "BEHAVIOR"
  if (preferences && hasPreferences(preferences)) return "PREFERENCES"
  return "GENERIC"
}

export function isEmptyBehavior(behavior: BehaviorSignals): boolean {
  return (
    Object.keys(behavior.neighborhoods).length === 0 &&
    Object.keys(behavior.communes).length === 0 &&
    Object.keys(behavior.propertyTypes).length === 0 &&
    Object.keys(behavior.amenities).length === 0
  )
}

export function hasPreferences(preferences: DeclaredPreferences): boolean {
  return (
    preferences.listingTypes.length > 0 ||
    preferences.budget !== null ||
    preferences.propertyTypeIds.length > 0 ||
    preferences.neighborhoodIds.length > 0 ||
    preferences.communeIds.length > 0 ||
    preferences.amenityCodes.length > 0 ||
    preferences.bedrooms !== null ||
    preferences.bathrooms !== null ||
    preferences.surface.min !== null ||
    preferences.surface.max !== null ||
    preferences.point !== null
  )
}
