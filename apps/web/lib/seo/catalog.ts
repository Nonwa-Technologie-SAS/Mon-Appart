import { cache } from "react"

import type { PropertyType } from "@/lib/domain-enums"
import { nestSearchListings } from "@/lib/nest-listings"

import { CATALOG_DESTINATIONS, type SeoDestination } from "./paths"
import { locationSlug } from "./slug"

export const countAvailableByType = cache(async (type: PropertyType | null) => {
  const items = await nestSearchListings(type ? { type } : {})
  return items.length
})

/** Destinations catalogue ayant assez d'annonces pour être utiles. */
export async function listableDestinations(): Promise<SeoDestination[]> {
  const results: SeoDestination[] = []
  for (const dest of CATALOG_DESTINATIONS) {
    const count = await countAvailableByType(dest.type)
    if (count >= dest.minListings) results.push(dest)
  }
  return results
}

export type LocationFacet = {
  location: string
  slug: string
  count: number
}

export const listLocationFacets = cache(
  async (minCount = 1): Promise<LocationFacet[]> => {
    const items = await nestSearchListings({})
    const counts = new Map<string, number>()
    for (const item of items) {
      const loc = item.location.trim()
      if (!loc) continue
      counts.set(loc, (counts.get(loc) ?? 0) + 1)
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([location, count]) => ({
        location,
        slug: locationSlug(location),
        count,
      }))
      .toSorted((a, b) => b.count - a.count)
  },
)

export async function findLocationBySlug(
  slug: string,
): Promise<LocationFacet | null> {
  const facets = await listLocationFacets(1)
  return facets.find((facet) => facet.slug === slug) ?? null
}

export async function listSitemapProperties(take = 5_000) {
  const items = await nestSearchListings({})
  return items.slice(0, take).map((item) => ({
    id: item.id,
    title: item.title,
    updatedAt:
      typeof item.createdAt === "string"
        ? new Date(item.createdAt)
        : item.createdAt,
  }))
}
