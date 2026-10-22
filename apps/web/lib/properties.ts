import { cache } from "react"

import { PropertyStatus, PropertyType } from "@/lib/domain-enums"
import {
  mapOwnerListingSummary,
  nestFeaturedListings,
  nestGetListing,
  nestSearchListings,
  type PropertyDetailView,
} from "@/lib/nest-listings"
import { nestListMine } from "@/lib/nest-publish"

export type { PropertyDetailView }

export type PropertyListItem = {
  id: string
  title: string
  description: string
  price: number
  type: PropertyType
  location: string
  latitude: number | null
  longitude: number | null
  imageUrl: string | null
  agencyName: string | null
  createdAt: Date | string
  beds: string | null
  baths: string | null
  surface: string | null
  distanceKm: number | null
}

export type PropertySearchParams = {
  q?: string
  type?: string
  maxPrice?: string
  lat?: string
  lng?: string
  locationExact?: string
}

export type OwnerPropertyListItem = PropertyListItem & {
  status: PropertyStatus
}

export const searchAvailableProperties = cache(
  async (params: PropertySearchParams = {}): Promise<PropertyListItem[]> => {
    return nestSearchListings(params)
  },
)

export const getFeaturedProperties = cache(async (): Promise<PropertyListItem[]> => {
  return nestFeaturedListings()
})

export async function listPropertiesByUserId(
  _userId: string,
): Promise<OwnerPropertyListItem[]> {
  const items = await nestListMine()
  return items.map(mapOwnerListingSummary)
}

export async function getAvailablePropertyById(
  id: string,
  _viewerUserId?: string,
): Promise<PropertyDetailView | null> {
  return nestGetListing(id)
}
