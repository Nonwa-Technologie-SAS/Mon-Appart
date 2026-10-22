import type {
  FacetBucket,
  ListingType,
  PriceRangeBucket,
  SearchFacetName,
  SearchFacets,
} from "@mon-appart/types"

import type { NeighborhoodEntry } from "../../property"
import type { RawFacetCounts } from "../domain/search-engine"
import { BEDROOMS_FACET_MAX } from "../infrastructure/postgres/postgres-search.engine"

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  RENT: "Location",
  SALE: "Vente",
  SHORT_TERM_RENT: "Location courte durée",
  LEASE_TO_OWN: "Location-accession",
}

export interface FacetReferential {
  propertyTypeNames: ReadonlyMap<string, string>
  amenityNames: ReadonlyMap<string, string>
  neighborhoods: ReadonlyMap<number, NeighborhoodEntry>
  priceBounds: readonly number[]
}

const byCount = (buckets: FacetBucket[]) =>
  buckets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

/** Libellés et agrégation ville / commune à partir des comptes par quartier. */
export function labelFacets(
  raw: RawFacetCounts,
  wanted: readonly SearchFacetName[],
  ref: FacetReferential,
): SearchFacets {
  const want = new Set(wanted)
  const facets: SearchFacets = {}
  const fromMap = (
    map: ReadonlyMap<string, number> | undefined,
    label: (code: string) => string,
  ) =>
    byCount(
      [...(map ?? new Map<string, number>())].map(([value, count]) => ({
        value,
        label: label(value),
        count,
      })),
    )

  if (want.has("propertyTypes")) {
    facets.propertyTypes = fromMap(
      raw.propertyTypes,
      (code) => ref.propertyTypeNames.get(code) ?? code,
    )
  }
  if (want.has("listingTypes")) {
    facets.listingTypes = fromMap(
      raw.listingTypes,
      (code) => LISTING_TYPE_LABELS[code as ListingType] ?? code,
    )
  }
  if (want.has("amenities")) {
    facets.amenities = fromMap(
      raw.amenities,
      (code) => ref.amenityNames.get(code) ?? code,
    )
  }
  if (want.has("bedrooms")) {
    facets.bedrooms = [...(raw.bedrooms ?? new Map<number, number>())]
      .sort(([a], [b]) => a - b)
      .map(([value, count]) => ({
        value: String(value),
        label:
          value >= BEDROOMS_FACET_MAX
            ? `${BEDROOMS_FACET_MAX}+`
            : String(value),
        count,
      }))
  }
  if (want.has("cities") || want.has("communes") || want.has("neighborhoods")) {
    const cities = new Map<string, FacetBucket>()
    const communes = new Map<string, FacetBucket>()
    const neighborhoods: FacetBucket[] = []
    for (const [id, count] of raw.neighborhoods ?? []) {
      const entry = ref.neighborhoods.get(id)
      if (!entry) continue
      neighborhoods.push({
        value: entry.code,
        label: `${entry.name}, ${entry.communeName}`,
        count,
      })
      const commune = communes.get(entry.communeCode) ?? {
        value: entry.communeCode,
        label: entry.communeName,
        count: 0,
      }
      commune.count += count
      communes.set(entry.communeCode, commune)
      const city = cities.get(entry.cityCode) ?? {
        value: entry.cityCode,
        label: entry.cityName,
        count: 0,
      }
      city.count += count
      cities.set(entry.cityCode, city)
    }
    if (want.has("cities")) facets.cities = byCount([...cities.values()])
    if (want.has("communes")) facets.communes = byCount([...communes.values()])
    if (want.has("neighborhoods")) facets.neighborhoods = byCount(neighborhoods)
  }
  if (want.has("priceRanges")) {
    const bounds = ref.priceBounds
    const counts = raw.priceRanges ?? []
    const ranges: PriceRangeBucket[] = []
    for (let i = 0; i <= bounds.length; i += 1) {
      ranges.push({
        min: i === 0 ? null : (bounds[i - 1] ?? null),
        max: i === bounds.length ? null : (bounds[i] ?? null),
        count: counts[i] ?? 0,
      })
    }
    facets.priceRanges = ranges
  }
  return facets
}
