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

  const bedrooms = input.beds ? Number.parseInt(input.beds, 10) : null
  const bathrooms = input.baths ? Number.parseInt(input.baths, 10) : null
  const surface = input.surface
    ? Number.parseFloat(input.surface.replace(/[^\d.,]/g, "").replace(",", "."))
    : null

  const property = await nestServerFetch<{ id: string }>("/properties", {
    method: "POST",
    body: {
      propertyType: webTypeToNest(input.type),
      commune: place.commune,
      neighborhood: place.neighborhood,
      title: input.title,
      description: input.description,
      surface: Number.isFinite(surface) ? surface : null,
      bedrooms: Number.isFinite(bedrooms) ? bedrooms : null,
      bathrooms: Number.isFinite(bathrooms) ? bathrooms : null,
      latitude,
      longitude,
      locationVisibility: "APPROXIMATE",
      address: input.location,
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

  await nestServerFetch(`/listings/${listing.id}/publish`, {
    method: "POST",
    body: {},
  })

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
