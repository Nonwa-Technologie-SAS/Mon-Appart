import { createHash } from "node:crypto"

import type { SearchQuery } from "./search-query"

const sorted = (values: readonly string[]) => [...values].sort()

/**
 * Forme canonique d'une recherche : ordre des listes, casse et valeurs par
 * défaut sont déjà normalisés par `parseSearchQuery`. Deux URL équivalentes
 * (`?commune=Cocody&listingType=RENT` et `?listingType=rent&commune=cocody`)
 * produisent la même forme. Le curseur et `submit` n'en font pas partie.
 */
export function canonicalSearch(query: SearchQuery): string {
  return JSON.stringify({
    q: query.text?.tokens ?? null,
    lt: sorted(query.listingTypes),
    pt: sorted(query.propertyTypes),
    ci: sorted(query.cities),
    co: sorted(query.communes),
    ne: sorted(query.neighborhoods),
    geo: query.geo
      ? [query.geo.latitude, query.geo.longitude, query.geo.radiusKm]
      : null,
    pr: [query.price.min, query.price.max],
    su: [query.surface.min, query.surface.max],
    ls: [query.landSurface.min, query.landSurface.max],
    be: [query.bedrooms.min, query.bedrooms.max],
    ba: [query.bathrooms.min, query.bathrooms.max],
    am: sorted(query.amenities),
    amm: query.amenitiesMode,
    s: query.sort,
    l: query.limit,
    f: sorted(query.facets),
  })
}

export function searchFingerprint(query: SearchQuery): string {
  return createHash("sha256").update(canonicalSearch(query)).digest("hex")
}

/**
 * Clés Redis du module. Le numéro de génération change à chaque événement
 * d'annonce ou de bien : les anciennes entrées deviennent inaccessibles et
 * expirent seules (pas de SCAN/DEL massif).
 */
export const SearchCacheKeyBuilder = {
  generation: (): string => "search:generation",
  results: (query: SearchQuery, generation: number, engine: string): string =>
    `search:v1:${engine}:${generation}:${searchFingerprint(query)}`,
  suggestions: (
    normalized: string,
    limit: number,
    generation: number,
  ): string =>
    `search:suggest:v1:${generation}:${limit}:${createHash("sha256").update(normalized).digest("hex").slice(0, 32)}`,
}
