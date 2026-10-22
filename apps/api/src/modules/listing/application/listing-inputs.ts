import type {
  ListingStatus,
  ListingType,
  PricePeriod,
} from "../../../generated/prisma/enums"

export interface PriceFields {
  amount: number
  period: PricePeriod
  currency?: string
}

export interface CreateListingInput {
  propertyId: string
  listingType: ListingType
  title?: string
  description?: string | null
  price?: PriceFields
}

export interface UpdateListingInput {
  title?: string
  description?: string | null
  expiresAt?: Date
}

export interface ChangePriceInput extends PriceFields {
  reason?: string
}

export interface ChangeStatusInput {
  status: ListingStatus
  reason?: string
  expiresAt?: Date
  /** Statut vu par l'appelant : s'il a changé entre-temps, 409 sans écriture. */
  expectedStatus?: ListingStatus
}

export interface StatusTransitionResult {
  listingId: bigint
  publicId: string
  createdById: bigint
  title: string
  from: ListingStatus
  to: ListingStatus
}

export interface ListingSearchInput {
  scope?: "public" | "mine" | "all"
  status?: ListingStatus
  listingType?: ListingType
  propertyType?: string
  commune?: string
  neighborhood?: string
  minPrice?: number
  maxPrice?: number
  period?: PricePeriod
  minSurface?: number
  maxSurface?: number
  bedrooms?: number
  bathrooms?: number
  latitude?: number
  longitude?: number
  radiusKm?: number
  cursor?: string
  limit?: number
}
