/**
 * Publication multi-étapes Nest : property → listing → publish.
 */

import { nestServerFetch } from "@/lib/nest-session"
import { geocodeLocation, hasCoordinates } from "@/lib/geocode"

const COMMUNE_HINTS: { match: RegExp; commune: string; neighborhood: string }[] =
  [
    { match: /riviera|cocody/i, commune: "COCODY", neighborhood: "RIVIERA" },
    { match: /marcory|zone\s*4/i, commune: "MARCORY", neighborhood: "ZONE_4" },
    {
      match: /bingerville|feh/i,
      commune: "BINGERVILLE",
      neighborhood: "FEH_KESSE",
    },
  ]

function resolvePlace(location: string): {
  commune: string
  neighborhood: string
} {
  for (const hint of COMMUNE_HINTS) {
    if (hint.match.test(location)) {
      return { commune: hint.commune, neighborhood: hint.neighborhood }
    }
  }
  return { commune: "COCODY", neighborhood: "RIVIERA" }
}

/** Nest convertit `null` en 0. Un champ optionnel vide doit être absent. */
function optionalInt(key: string, value: number): Record<string, number> {
  if (!Number.isInteger(value) || value < 0) return {}
  return { [key]: value }
}

function optionalNumber(
  key: string,
  value: number,
  min: number,
): Record<string, number> {
  if (!Number.isFinite(value) || value < min) return {}
  return { [key]: Math.round(value * 100) / 100 }
}

function optionalCoord(
  key: string,
  value: number | null,
  maxAbs: number,
): Record<string, number> {
  if (value === null || !Number.isFinite(value) || Math.abs(value) > maxAbs) {
    return {}
  }
  return { [key]: Math.round(value * 1_000_000) / 1_000_000 }
}

function webTypeToNest(type: string): string {
  const upper = type.toUpperCase()
  if (upper === "HOUSE") return "HOUSE"
  if (upper === "STUDIO") return "STUDIO"
  if (upper === "VILLA") return "VILLA"
  if (upper === "LAND") return "LAND"
  if (upper === "OFFICE") return "OFFICE"
  if (upper === "COMMERCIAL") return "COMMERCIAL"
  return "APARTMENT"
}

export async function nestPublishListing(input: {
  title: string
  description: string
  price: number
  type: string
  location: string
  beds?: string
  baths?: string
  surface?: string
  latitude?: number | null
  longitude?: number | null
  /** `false` laisse l'annonce en brouillon le temps d'envoyer les photos. */
  publish?: boolean
}): Promise<{ listingId: string; propertyId: string }> {
  const place = resolvePlace(input.location)
  let latitude = input.latitude ?? null
  let longitude = input.longitude ?? null
  if (!hasCoordinates(latitude, longitude)) {
    try {
      const coords = await geocodeLocation(input.location)
      latitude = coords.lat
      longitude = coords.lng
    } catch {
      // Nest accepte sans coords
    }
  }

  const bedrooms = input.beds ? Number.parseInt(input.beds, 10) : Number.NaN
  const bathrooms = input.baths ? Number.parseInt(input.baths, 10) : Number.NaN
  const surface = input.surface
    ? Number.parseFloat(input.surface.replace(/[^\d.,]/g, "").replace(",", "."))
    : Number.NaN

  const property = await nestServerFetch<{ id: string }>("/properties", {
    method: "POST",
    body: {
      propertyType: webTypeToNest(input.type),
      commune: place.commune,
      neighborhood: place.neighborhood,
      title: input.title,
      description: input.description,
      locationVisibility: "APPROXIMATE",
      address: input.location,
      ...optionalNumber("surface", surface, 1),
      ...optionalInt("bedrooms", bedrooms),
      ...optionalInt("bathrooms", bathrooms),
      ...optionalCoord("latitude", latitude, 90),
      ...optionalCoord("longitude", longitude, 180),
    },
  })

  const listing = await nestServerFetch<{ id: string }>("/listings", {
    method: "POST",
    body: {
      propertyId: property.id,
      listingType: "RENT",
      title: input.title,
      description: input.description,
      price: {
        amount: Math.round(input.price),
        period: "MONTH",
        currency: "XOF",
      },
    },
  })

  if (input.publish !== false) {
    await activateNestProperty(property.id)
    await nestServerFetch(`/listings/${listing.id}/publish`, {
      method: "POST",
      body: {},
    })
  }

  return { listingId: listing.id, propertyId: property.id }
}

export type NestMineListing = {
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
}

export async function nestListMine(): Promise<NestMineListing[]> {
  const page = await nestServerFetch<{ items: NestMineListing[] }>("/listings", {
    query: { scope: "mine", limit: 50 },
  })
  return page.items
}

/** DRAFT → ACTIVE. Nest refuse la publication d'une annonce tant que le bien est en brouillon. */
export async function activateNestProperty(propertyId: string): Promise<void> {
  await nestServerFetch(`/properties/${propertyId}`, {
    method: "PATCH",
    body: { status: "ACTIVE" },
  })
}

export async function nestUpdateListingVisibility(
  listingId: string,
  available: boolean,
): Promise<void> {
  if (available) {
    await nestServerFetch(`/listings/${listingId}/publish`, {
      method: "POST",
      body: {},
    })
  } else {
    await nestServerFetch(`/listings/${listingId}/pause`, {
      method: "POST",
      body: { reason: "Pause depuis l’espace éditeur" },
    })
  }
}

/**
 * Retrait soft : l'annonce est archivée et masquée (`deletedAt`),
 * l'historique et les données restent côté API.
 */
export async function nestWithdrawListing(listingId: string): Promise<void> {
  await nestServerFetch(`/listings/${listingId}`, { method: "DELETE" })
}

export type OwnedListingEdit = {
  listingId: string
  propertyId: string
  title: string
  description: string
  price: number
  location: string
  beds: string
  baths: string
  surface: string
  type: string
}

export async function nestGetOwnedListing(
  listingId: string,
): Promise<OwnedListingEdit> {
  const listing = await nestServerFetch<{
    id: string
    title: string
    description: string | null
    price: { amount: string } | null
    property: {
      id: string
      propertyType: { code: string }
      bedrooms?: number | null
      bathrooms?: number | null
      surface?: string | number | null
      address?: string | null
    }
    location: {
      neighborhood?: { name: string }
      commune?: { name: string }
      city?: { name: string }
      label?: string
    }
  }>(`/listings/${listingId}`)

  const location =
    listing.property.address?.trim() ||
    listing.location.label?.trim() ||
    [
      listing.location.neighborhood?.name,
      listing.location.commune?.name,
      listing.location.city?.name,
    ]
      .filter(Boolean)
      .join(", ")

  return {
    listingId: listing.id,
    propertyId: listing.property.id,
    title: listing.title,
    description: listing.description ?? "",
    price: listing.price ? Number(listing.price.amount) : 0,
    location,
    beds:
      listing.property.bedrooms != null
        ? String(listing.property.bedrooms)
        : "",
    baths:
      listing.property.bathrooms != null
        ? String(listing.property.bathrooms)
        : "",
    surface:
      listing.property.surface != null ? String(listing.property.surface) : "",
    type: listing.property.propertyType.code,
  }
}

export async function nestUpdateOwnedListing(input: {
  listingId: string
  propertyId: string
  title: string
  description: string
  price: number
  location: string
  beds?: string
  baths?: string
  surface?: string
}): Promise<void> {
  const bedrooms = input.beds ? Number.parseInt(input.beds, 10) : Number.NaN
  const bathrooms = input.baths ? Number.parseInt(input.baths, 10) : Number.NaN
  const surface = input.surface
    ? Number.parseFloat(
        input.surface.replace(/[^\d.,]/g, "").replace(",", "."),
      )
    : Number.NaN

  await nestServerFetch(`/listings/${input.listingId}`, {
    method: "PATCH",
    body: {
      title: input.title,
      description: input.description,
    },
  })

  await nestServerFetch(`/listings/${input.listingId}/price`, {
    method: "PUT",
    body: {
      amount: Math.round(input.price),
      period: "MONTH",
      currency: "XOF",
    },
  })

  await nestServerFetch(`/properties/${input.propertyId}`, {
    method: "PATCH",
    body: {
      title: input.title,
      description: input.description,
      address: input.location,
      ...optionalNumber("surface", surface, 1),
      ...optionalInt("bedrooms", bedrooms),
      ...optionalInt("bathrooms", bathrooms),
    },
  })
}
