import type { ListingType } from "./index"
import type { SearchResultItem } from "./search"

/** Contrat public de `/api/v1/recommendations`, partagé avec les frontends. */
export const RECOMMENDATION_CONTEXTS = ["PERSONALIZED", "SIMILAR"] as const

export type RecommendationContext = (typeof RECOMMENDATION_CONTEXTS)[number]

/** Codes stables : le frontend peut les traduire ou les regrouper. */
export const RECOMMENDATION_REASON_LABELS = {
  BUDGET_MATCH: "Dans votre budget",
  BUDGET_WITHIN_TOLERANCE:
    "Légèrement au-dessus de votre budget, dans la marge acceptée",
  PREFERRED_NEIGHBORHOOD: "Dans un quartier que vous recherchez",
  PREFERRED_COMMUNE: "Dans une commune que vous recherchez",
  /** Alias stable Prompt 20 — même sémantique que PREFERRED_* / NEAR_*. */
  LOCATION_MATCH: "Localisation adaptée à votre recherche",
  NEAR_PREFERRED_POINT: "Proche du lieu indiqué",
  PROPERTY_TYPE_MATCH: "Le type de bien que vous recherchez",
  BEDROOMS_MATCH: "Nombre de chambres adapté",
  SURFACE_MATCH: "Surface adaptée",
  AMENITIES_MATCH: "Équipements souhaités",
  FEATURES_MATCH: "Caractéristiques correspondant à vos critères",
  MATCHES_YOUR_ACTIVITY: "Proche des annonces qui vous ont intéressé",
  USER_PREFERENCE_MATCH: "Correspond à vos préférences",
  RECENTLY_PUBLISHED: "Publiée récemment",
  RECENT_LISTING: "Annonce récente",
  COMPLETE_LISTING: "Annonce complète",
  POPULAR: "Souvent consultée",
  DIVERSITY_ADJUSTMENT: "Diversité des résultats",
  SIMILAR_PRICE: "Prix proche",
  SAME_NEIGHBORHOOD: "Même quartier",
  SAME_COMMUNE: "Même commune",
  SAME_PROPERTY_TYPE: "Même type de bien",
} as const

export type RecommendationReasonCode = keyof typeof RECOMMENDATION_REASON_LABELS

export interface RecommendationReason {
  code: RecommendationReasonCode
  label: string
}

export interface RecommendationItem {
  /** Identifiant à renvoyer avec un retour ; `null` pour un visiteur (non persisté). */
  id: string | null
  context: RecommendationContext
  /** Adéquation 0..100. Ce n'est pas un score de confiance de l'annonce. */
  score: number
  reasons: RecommendationReason[]
  listing: SearchResultItem
  generatedAt: string
}

/**
 * `GENERIC` : aucun signal (visiteur ou nouveau compte) ;
 * `PREFERENCES` : préférences déclarées ; `BEHAVIOR` : préférences et/ou activité.
 */
export type RecommendationLevel = "GENERIC" | "PREFERENCES" | "BEHAVIOR"

export interface RecommendationResponse {
  items: RecommendationItem[]
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number }
  meta: {
    context: RecommendationContext
    level: RecommendationLevel
    algorithmVersion: string
    /** Vrai si le moteur configuré a échoué et que le moteur à règles a répondu. */
    degraded: boolean
    /** Identifiant de cette page servie, à renvoyer dans les événements analytiques. */
    requestId: string
  }
}

export const RECOMMENDATION_FEEDBACK_TYPES = [
  "DISPLAYED",
  "CLICKED",
  "INTERESTED",
  "NOT_INTERESTED",
  "IRRELEVANT",
  "WRONG_BUDGET",
  "WRONG_LOCATION",
] as const

export type RecommendationFeedbackType =
  (typeof RECOMMENDATION_FEEDBACK_TYPES)[number]

export const BUDGET_PERIODS = ["DAY", "WEEK", "MONTH", "YEAR", "TOTAL"] as const

export type BudgetPeriod = (typeof BUDGET_PERIODS)[number]

/** Préférences déclarées. Les lieux, types et équipements sont des codes. */
export interface RecommendationPreferences {
  listingTypes: ListingType[]
  budget: {
    min: number | null
    max: number | null
    currency: string
    period: BudgetPeriod | null
    /** Dépassement accepté du maximum, en % (0..30). */
    tolerancePct: number
  }
  propertyTypes: string[]
  communes: string[]
  neighborhoods: string[]
  amenities: string[]
  bedrooms: number | null
  bathrooms: number | null
  surface: { min: number | null; max: number | null }
  point: { latitude: number; longitude: number; radiusKm: number } | null
  updatedAt: string | null
}
