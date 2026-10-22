import type { ListingType } from "@mon-appart/types"

/** Critères immobiliers extraits et validés — jamais inventés par un LLM non contrôlé. */
export type PricePeriod = "MONTH" | "DAY" | "TOTAL" | "UNKNOWN"

export type SoftPreference =
  | "CALM_AREA"
  | "QUICK_MOVE_IN"
  | "FAMILY"
  | "NEAR_SHOPS"
  | "OUTDOOR_SPACE"

export interface AssistantCriteria {
  listingTypes: ListingType[]
  propertyTypes: string[]
  communes: string[]
  neighborhoods: string[]
  cities: string[]
  priceMin: number | null
  priceMax: number | null
  currency: "XOF"
  pricePeriod: PricePeriod
  bedroomsMin: number | null
  bathroomsMin: number | null
  surfaceMin: number | null
  surfaceMax: number | null
  amenities: string[]
  softPreferences: SoftPreference[]
  /** Critères non vérifiables en filtre strict (ex. « calme »). */
  unverifiableHints: string[]
  missing: Array<"listingType" | "budget" | "location" | "propertyType">
  clarificationQuestion: string | null
  /** Texte libre résiduel utile à Search `q` (sans inventer de localité). */
  freeText: string | null
  /** L’utilisateur a explicitement accepté de chercher sans budget. */
  acceptSearchWithoutBudget: boolean
  /** L’utilisateur accepte une recherche sur toute la ville (ex. Abidjan). */
  acceptCityWide: boolean
  confidence: number
}

export interface AssistantListingCard {
  listingId: string
  propertyId: string
  title: string
  listingType: ListingType
  propertyType: { code: string; name: string }
  price: { amount: number; currency: string; period: string } | null
  surface: number | null
  bedrooms: number | null
  bathrooms: number | null
  locationLabel: string
  mainImage: string | null
  matchReasons: string[]
}

export interface AssistantTurnResult {
  mode: "clarify" | "results" | "empty" | "error"
  message: string
  criteria: AssistantCriteria
  searchParams: Record<string, string>
  listings: AssistantListingCard[]
  suggestions: string[]
  provider: "rules" | "openai" | "degraded"
  conversationId: string
}
