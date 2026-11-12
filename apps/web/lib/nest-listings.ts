/**
 * Lecture catalogue Nest → formes UI web (PropertyListItem / fiche).
 */

import { PropertyStatus, PropertyType } from "@/lib/domain-enums"
import { nestApiUrl } from "@/lib/nest-url"

/** Aligné sur `PropertyListItem` / `PropertySearchParams` (évite import circulaire). */
export type NestPropertyListItem = {
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

export type NestPropertySearchParams = {
  q?: string
  type?: string
  maxPrice?: string
  lat?: string
  lng?: string
  locationExact?: string
}

type NestSearchItem = {
  listingId: string
  propertyId: string
  title: string
  listingType: string
  propertyType: { code: string; name: string }
  price: { amount: number; currency: string; period: string } | null
  surface: number | null
  bedrooms: number | null
  bathrooms: number | null
  location: {
    city: { name: string }
    commune: { name: string }
    neighborhood: { name: string }
    latitude: number | null
    longitude: number | null
  }
  mainImage: string | null
  distance: { value: number; unit: string } | null
  publishedAt: string
}

type NestSearchResponse = {
  items: NestSearchItem[]
}

type NestMediaItem = {
  id: string
  url: string
  kind?: string
  type?: string
  room?: string | null
  sortOrder?: number
}

type NestListingDetail = {
  id: string
  listingType: string
  status: string
  title: string
  description: string | null
  price: { amount: string; currency: string; period: string } | null
  property: {
    id: string
    title?: string
    propertyType: { code: string; name: string }
    surface: string | null
    bedrooms: number | null
    bathrooms: number | null
    rooms: number | null
    amenities: { code: string; name: string }[]
  }
  location: {
    city?: { name: string }
    commune?: { name: string }
    neighborhood?: { name: string }
    label?: string
    latitude?: number | null
    longitude?: number | null
  }
  media: {
    items?: NestMediaItem[]
    coverUrl?: string | null
  }
  publishedAt: string | null
  updatedAt?: string
  createdAt?: string
}

export type PropertyDetailView = {
  id: string
  title: string
  description: string
  price: number
  type: PropertyType
  location: string
  status: PropertyStatus
  updatedAt: Date
  latitude: number | null
  longitude: number | null
  media: Array<{
    id: string
    url: string
    type: string
    room: string | null
    sortOrder: number
  }>
  features: Array<{ id: string; name: string; value: string }>
  agency: { name: string; phone: string | null; email: string | null } | null
  amenities: Array<{ amenity: { name: string; code?: string } }>
  reviews: []
  userId?: string
}

function mapPropertyType(code: string): PropertyType {
  const upper = code.toUpperCase()
  if ((Object.values(PropertyType) as string[]).includes(upper)) {
    return upper as PropertyType
  }
  if (upper === "APARTMENT") return PropertyType.APARTMENT
  if (upper === "HOUSE") return PropertyType.HOUSE
  if (upper === "STUDIO") return PropertyType.STUDIO
  if (upper === "VILLA") return PropertyType.VILLA
  if (upper === "LAND") return PropertyType.LAND
  if (upper === "OFFICE") return PropertyType.OFFICE
  if (upper === "COMMERCIAL") return PropertyType.COMMERCIAL
  return PropertyType.APARTMENT
}

function formatLocation(loc: NestSearchItem["location"]): string {
  return [loc.neighborhood?.name, loc.commune?.name, loc.city?.name]
    .filter(Boolean)
    .join(", ")
}

function mapSearchItem(item: NestSearchItem): NestPropertyListItem {
  return {
    id: item.listingId,
    title: item.title,
    description: "",
    price: item.price?.amount ?? 0,
    type: mapPropertyType(item.propertyType.code),
    location: formatLocation(item.location),
    latitude: item.location.latitude,
    longitude: item.location.longitude,
    imageUrl: item.mainImage,
    agencyName: null,
    createdAt: item.publishedAt,
    beds: item.bedrooms != null ? String(item.bedrooms) : null,
    baths: item.bathrooms != null ? String(item.bathrooms) : null,
    surface: item.surface != null ? String(item.surface) : null,
    distanceKm: item.distance?.value ?? null,
  }
}

function webTypeToNestCode(type?: string): string | undefined {
  if (!type) return undefined
  return type.toUpperCase()
}

export async function nestSearchListings(
  params: NestPropertySearchParams = {},
): Promise<NestPropertyListItem[]> {
  const query = new URLSearchParams()
  query.set("limit", "80")
  if (params.q?.trim()) query.set("q", params.q.trim())
  const typeCode = webTypeToNestCode(params.type)
  if (typeCode) query.set("propertyType", typeCode)
  if (params.maxPrice) query.set("maxPrice", params.maxPrice)
  if (params.lat && params.lng) {
    query.set("lat", params.lat)
    query.set("lng", params.lng)
  }
  if (params.locationExact?.trim()) {
    query.set("q", params.locationExact.trim())
  }

  const res = await fetch(nestApiUrl(`/api/v1/search?${query}`), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Nest search HTTP ${res.status}`)
  const body = (await res.json()) as NestSearchResponse
  return body.items.map(mapSearchItem)
}

export async function nestFeaturedListings(): Promise<NestPropertyListItem[]> {
  const items = await nestSearchListings({})
  return items.slice(0, 6)
}

function listingStatusToWeb(status: string): PropertyStatus {
  if (status === "PUBLISHED") return PropertyStatus.AVAILABLE
  return PropertyStatus.ARCHIVED
}

function detailLocationLabel(loc: NestListingDetail["location"]): string {
  if (loc.label) return loc.label
  return [loc.neighborhood?.name, loc.commune?.name, loc.city?.name]
    .filter(Boolean)
    .join(", ")
}

export async function nestGetListing(
  publicId: string,
): Promise<PropertyDetailView | null> {
  const res = await fetch(nestApiUrl(`/api/v1/listings/${publicId}`), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Nest listing HTTP ${res.status}`)
  const listing = (await res.json()) as NestListingDetail

  const mediaItems = listing.media.items ?? []
  const features: PropertyDetailView["features"] = []
  if (listing.property.bedrooms != null) {
    features.push({
      id: "beds",
      name: "Chambres",
      value: String(listing.property.bedrooms),
    })
  }
  if (listing.property.bathrooms != null) {
    features.push({
      id: "baths",
      name: "Salles de bain",
      value: String(listing.property.bathrooms),
    })
  }
  if (listing.property.surface) {
    features.push({
      id: "surface",
      name: "Surface",
      value: `${listing.property.surface} m²`,
    })
  }

  const price = listing.price ? Number(listing.price.amount) : 0

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description ?? "",
    price: Number.isFinite(price) ? price : 0,
    type: mapPropertyType(listing.property.propertyType.code),
    location: detailLocationLabel(listing.location),
    status: listingStatusToWeb(listing.status),
    updatedAt: new Date(
      listing.updatedAt ?? listing.publishedAt ?? listing.createdAt ?? Date.now(),
    ),
    latitude: listing.location.latitude ?? null,
    longitude: listing.location.longitude ?? null,
    media:
      mediaItems.length > 0
        ? mediaItems.map((m, index) => ({
            id: m.id,
            url: m.url,
            type: (m.kind ?? m.type ?? "IMAGE").toUpperCase().includes("VIRTUAL")
              ? "VIRTUAL_TOUR"
              : "IMAGE",
            room: m.room ?? null,
            sortOrder: m.sortOrder ?? index,
          }))
        : listing.media.coverUrl
          ? [
              {
                id: "cover",
                url: listing.media.coverUrl,
                type: "IMAGE",
                room: null,
                sortOrder: 0,
              },
            ]
          : [],
    features,
    agency: null,
    amenities: (listing.property.amenities ?? []).map((a) => ({
      amenity: { name: a.name, code: a.code },
    })),
    reviews: [],
  }
}

export type NestOwnerListing = NestPropertyListItem & {
  status: PropertyStatus
  listingStatus: string
  propertyId: string
}

/** Annonces de l'utilisateur connecté (Bearer via nestServerFetch côté caller). */
export function mapOwnerListingSummary(raw: {
  id: string
  title: string
  price: { amount: string } | null
  property: {
    id: string
    propertyType: { code: string }
    bedrooms?: number | null
    bathrooms?: number | null
    surface?: string | null
  }
  location: {
    neighborhood?: { name: string }
    commune?: { name: string }
    city?: { name: string }
    latitude?: number | null
    longitude?: number | null
  }
  coverUrl: string | null
  publishedAt: string | null
  status?: string
}): NestOwnerListing {
  const status = listingStatusToWeb(raw.status ?? "PUBLISHED")
  return {
    id: raw.id,
    title: raw.title,
    description: "",
    price: raw.price ? Number(raw.price.amount) : 0,
    type: mapPropertyType(raw.property.propertyType.code),
    location: [
      raw.location.neighborhood?.name,
      raw.location.commune?.name,
      raw.location.city?.name,
    ]
      .filter(Boolean)
      .join(", "),
    latitude: raw.location.latitude ?? null,
    longitude: raw.location.longitude ?? null,
    imageUrl: raw.coverUrl,
    agencyName: null,
    createdAt: raw.publishedAt ?? new Date().toISOString(),
    beds:
      raw.property.bedrooms != null ? String(raw.property.bedrooms) : null,
    baths:
      raw.property.bathrooms != null ? String(raw.property.bathrooms) : null,
    surface: raw.property.surface ?? null,
    distanceKm: null,
    status,
    listingStatus: raw.status ?? "PUBLISHED",
    propertyId: raw.property.id,
  }
}
