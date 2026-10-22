import type { ResolvedSearch } from "../../domain/search-engine"
import { FACET_SAMPLE_CAP, TOTAL_COUNT_CAP } from "../../domain/search-engine"
import {
  activeWeights,
  FRESHNESS_HALF_LIFE_DAYS,
} from "../../domain/search-ranking"

type Json = Record<string, unknown>

/** Pondération des champs : titre, type, lieu > description > équipements. */
const TEXT_FIELDS = [
  "title^3",
  "propertyType.name^3",
  "location.neighborhoodName^3",
  "location.communeName^3",
  "location.cityName^3",
  "description^1.5",
  "amenities.name^0.5",
]

function range(
  field: string,
  min: number | null,
  max: number | null,
): Json | null {
  if (min === null && max === null) return null
  return {
    range: {
      [field]: {
        ...(min !== null ? { gte: min } : {}),
        ...(max !== null ? { lte: max } : {}),
      },
    },
  }
}

/**
 * Traduit une recherche validée en corps OpenSearch. Le texte utilisateur
 * n'apparaît que comme valeur de `multi_match.query` (déjà normalisé en mots
 * `[a-z0-9]`), jamais comme fragment de DSL.
 */
export function buildOpenSearchQuery(
  request: ResolvedSearch,
  priceBounds: readonly number[],
): Json {
  const { query } = request
  const filter: Json[] = [{ term: { status: "PUBLISHED" } }]
  if (query.listingTypes.length > 0) {
    filter.push({ terms: { listingType: query.listingTypes } })
  }
  if (query.propertyTypes.length > 0) {
    filter.push({ terms: { "propertyType.code": query.propertyTypes } })
  }
  if (request.neighborhoodIds) {
    filter.push({
      terms: { "location.neighborhoodId": request.neighborhoodIds },
    })
  }
  for (const clause of [
    range("price.amount", query.price.min, query.price.max),
    range("surfaceOrLand", query.surface.min, query.surface.max),
    range("landSurface", query.landSurface.min, query.landSurface.max),
    range("bedrooms", query.bedrooms.min, query.bedrooms.max),
    range("bathrooms", query.bathrooms.min, query.bathrooms.max),
  ]) {
    if (clause) filter.push(clause)
  }
  if (query.amenities.length > 0) {
    if (query.amenitiesMode === "AND") {
      for (const code of query.amenities) {
        filter.push({ term: { "amenities.code": code } })
      }
    } else {
      filter.push({ terms: { "amenities.code": query.amenities } })
    }
  }
  if (query.geo) {
    // `location.point` est déjà la position publiée (arrondie ou absente).
    filter.push({
      geo_distance: {
        distance: `${query.geo.radiusKm}km`,
        "location.point": { lat: query.geo.latitude, lon: query.geo.longitude },
      },
    })
  }

  const must: Json[] = query.text
    ? [
        {
          multi_match: {
            query: query.text.tokens.join(" "),
            fields: TEXT_FIELDS,
            type: "cross_fields",
            operator: "and",
            ...(request.fuzzy
              ? { type: "best_fields", fuzziness: "AUTO" }
              : {}),
          },
        },
      ]
    : [{ match_all: {} }]

  const firstPage = request.cursor === null
  const body: Json = {
    size: query.limit + 1,
    track_total_hits: firstPage ? TOTAL_COUNT_CAP + 1 : false,
    _source: false,
    query: relevanceQuery(request, { bool: { must, filter } }),
    sort: sortClause(request),
  }
  if (request.cursor?.key != null) {
    body.search_after = [Number(request.cursor.key), request.cursor.id]
  }
  if (firstPage && query.facets.length > 0) {
    body.aggs = aggregations(request, priceBounds)
  }
  return body
}

/** Même pondération que PostgreSQL (search-ranking.ts), en fonctions de score. */
function relevanceQuery(request: ResolvedSearch, base: Json): Json {
  if (request.query.sort !== "RELEVANCE") return base
  const weights = activeWeights({
    text: request.query.text !== null,
    location: request.query.geo !== null,
  })
  const functions: Json[] = [
    {
      gauss: {
        publishedAt: {
          origin: request.asOf.toISOString(),
          scale: `${FRESHNESS_HALF_LIFE_DAYS}d`,
          decay: 0.5,
        },
      },
      weight: weights.freshness,
    },
    {
      field_value_factor: { field: "qualityScore", missing: 0 },
      weight: weights.quality,
    },
  ]
  if (request.query.geo) {
    functions.push({
      gauss: {
        "location.point": {
          origin: {
            lat: request.query.geo.latitude,
            lon: request.query.geo.longitude,
          },
          scale: `${request.query.geo.radiusKm}km`,
        },
      },
      weight: weights.location,
    })
  }
  return {
    function_score: {
      query: base,
      functions,
      score_mode: "sum",
      boost_mode: request.query.text ? "sum" : "replace",
    },
  }
}

function sortClause(request: ResolvedSearch): Json[] {
  const tieBreak = (order: "asc" | "desc") => ({ listingId: { order } })
  switch (request.query.sort) {
    case "RELEVANCE":
      return [{ _score: { order: "desc" } }, tieBreak("desc")]
    case "NEWEST":
      return [{ publishedAt: { order: "desc" } }, tieBreak("desc")]
    case "PRICE_ASC":
      return [
        { "price.amount": { order: "asc", missing: "_last" } },
        tieBreak("asc"),
      ]
    case "PRICE_DESC":
      return [
        { "price.amount": { order: "desc", missing: "_last" } },
        tieBreak("desc"),
      ]
    case "SURFACE_ASC":
      return [
        { surfaceOrLand: { order: "asc", missing: "_last" } },
        tieBreak("asc"),
      ]
    case "SURFACE_DESC":
      return [
        { surfaceOrLand: { order: "desc", missing: "_last" } },
        tieBreak("desc"),
      ]
    case "DISTANCE": {
      const geo = request.query.geo!
      return [
        {
          _geo_distance: {
            "location.point": { lat: geo.latitude, lon: geo.longitude },
            order: "asc",
            unit: "m",
          },
        },
        tieBreak("asc"),
      ]
    }
  }
}

function aggregations(
  request: ResolvedSearch,
  priceBounds: readonly number[],
): Json {
  const wanted = new Set(request.query.facets)
  const aggs: Json = {}
  const terms = (field: string, size = 50) => ({ terms: { field, size } })
  if (wanted.has("propertyTypes"))
    aggs.propertyTypes = terms("propertyType.code")
  if (wanted.has("listingTypes")) aggs.listingTypes = terms("listingType", 10)
  if (
    wanted.has("cities") ||
    wanted.has("communes") ||
    wanted.has("neighborhoods")
  ) {
    aggs.neighborhoods = terms("location.neighborhoodId", 500)
  }
  if (wanted.has("bedrooms")) aggs.bedrooms = terms("bedrooms", 20)
  if (wanted.has("amenities")) aggs.amenities = terms("amenities.code", 100)
  if (wanted.has("priceRanges") && priceBounds.length > 0) {
    const ranges: Json[] = [{ to: priceBounds[0] }]
    for (let i = 1; i < priceBounds.length; i += 1) {
      ranges.push({ from: priceBounds[i - 1], to: priceBounds[i] })
    }
    ranges.push({ from: priceBounds[priceBounds.length - 1] })
    aggs.priceRanges = { range: { field: "price.amount", ranges } }
  }
  return {
    sample: { sampler: { shard_size: FACET_SAMPLE_CAP }, aggs },
  }
}
