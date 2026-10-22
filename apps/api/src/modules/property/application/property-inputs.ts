import type {
  LocationVisibility,
  OwnershipType,
  PropertyStatus,
} from "../../../generated/prisma/enums"

/**
 * Champs modifiables d'un bien. `undefined` : inchangé ; `null` : effacé
 * (champs facultatifs uniquement, les DTO refusent `null` ailleurs).
 */
export interface PropertyFields {
  propertyType?: string
  commune?: string
  neighborhood?: string
  title?: string
  description?: string | null
  surface?: number | null
  landSurface?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  rooms?: number | null
  floor?: number | null
  totalFloors?: number | null
  yearBuilt?: number | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  locationVisibility?: LocationVisibility
  attributes?: Record<string, unknown>
}

export interface CreatePropertyInput extends PropertyFields {
  propertyType: string
  commune: string
  neighborhood: string
  title: string
  amenities?: string[]
  ownershipType?: OwnershipType
}

export interface UpdatePropertyInput extends PropertyFields {
  status?: PropertyStatus
}

export interface PropertySearchInput {
  scope?: "public" | "mine" | "all"
  status?: PropertyStatus
  propertyType?: string
  commune?: string
  neighborhood?: string
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
