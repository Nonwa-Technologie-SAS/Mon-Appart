import type { MetadataRoute } from "next"

import { listLocationFacets, listableDestinations, listSitemapProperties } from "@/lib/seo/catalog"
import { GUIDE_PATHS, listingPath, locationPath } from "@/lib/seo/paths"
import { absoluteUrl, isIndexableEnvironment } from "@/lib/seo/site"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexableEnvironment() && process.env.NEXT_PUBLIC_SEO_SITEMAP !== "true") {
    return []
  }

  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: absoluteUrl("/a-propos"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ]

  for (const guide of GUIDE_PATHS) {
    entries.push({
      url: absoluteUrl(guide.path),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    })
  }

  try {
    const [destinations, locations, properties] = await Promise.all([
      listableDestinations(),
      listLocationFacets(1),
      listSitemapProperties(5_000),
    ])

    for (const dest of destinations) {
      entries.push({
        url: absoluteUrl(dest.path),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      })
    }

    for (const loc of locations) {
      entries.push({
        url: absoluteUrl(locationPath(loc.location)),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.7,
      })
    }

    for (const property of properties) {
      entries.push({
        url: absoluteUrl(listingPath(property.title, property.id)),
        lastModified: property.updatedAt,
        changeFrequency: "daily",
        priority: 0.6,
      })
    }
  } catch {
    // Sitemap partiel : pages statiques seulement si la base est indisponible.
  }

  return entries
}
