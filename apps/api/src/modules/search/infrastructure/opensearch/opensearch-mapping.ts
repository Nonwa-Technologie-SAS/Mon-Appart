import type { ListingSearchDocument } from "../../domain/listing-search-document"
import type { SynonymMap } from "../../domain/text-normalizer"

/**
 * Index `listings` : mapping explicite (pas de mapping dynamique), analyseur
 * français insensible aux accents, synonymes issus de SEARCH_SYNONYMS.
 */
export function listingIndexDefinition(
  synonyms: SynonymMap,
): Record<string, unknown> {
  const synonymRules = [...synonyms.entries()].map(
    ([term, alternatives]) => `${term}, ${alternatives.join(", ")}`,
  )
  const filters = ["lowercase", "asciifolding", "french_elision"]
  if (synonymRules.length > 0) filters.push("mon_appart_synonyms")
  filters.push("french_stop", "french_stemmer")

  return {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      analysis: {
        filter: {
          french_elision: {
            type: "elision",
            articles_case: true,
            articles: ["l", "m", "t", "qu", "n", "s", "j", "d", "c"],
          },
          french_stop: { type: "stop", stopwords: "_french_" },
          french_stemmer: { type: "stemmer", language: "light_french" },
          ...(synonymRules.length > 0
            ? {
                mon_appart_synonyms: {
                  type: "synonym_graph",
                  synonyms: synonymRules,
                },
              }
            : {}),
        },
        analyzer: {
          mon_appart_french: {
            type: "custom",
            tokenizer: "standard",
            filter: filters,
          },
        },
        normalizer: {
          folded: { type: "custom", filter: ["lowercase", "asciifolding"] },
        },
      },
    },
    mappings: {
      dynamic: "strict",
      properties: {
        schemaVersion: { type: "short" },
        listingId: { type: "keyword" },
        propertyId: { type: "keyword" },
        status: { type: "keyword" },
        listingType: { type: "keyword" },
        title: { type: "text", analyzer: "mon_appart_french" },
        description: { type: "text", analyzer: "mon_appart_french" },
        propertyType: {
          properties: {
            code: { type: "keyword" },
            name: { type: "text", analyzer: "mon_appart_french" },
          },
        },
        location: {
          properties: {
            cityCode: { type: "keyword" },
            cityName: { type: "text", analyzer: "mon_appart_french" },
            communeCode: { type: "keyword" },
            communeName: { type: "text", analyzer: "mon_appart_french" },
            neighborhoodId: { type: "integer" },
            neighborhoodCode: { type: "keyword" },
            neighborhoodName: { type: "text", analyzer: "mon_appart_french" },
            point: { type: "geo_point" },
            precision: { type: "keyword" },
          },
        },
        price: {
          properties: {
            amount: { type: "scaled_float", scaling_factor: 100 },
            currency: { type: "keyword" },
            period: { type: "keyword" },
          },
        },
        surface: { type: "float" },
        landSurface: { type: "float" },
        surfaceOrLand: { type: "float" },
        bedrooms: { type: "integer" },
        bathrooms: { type: "integer" },
        amenities: {
          properties: {
            code: { type: "keyword" },
            name: { type: "text", analyzer: "mon_appart_french" },
          },
        },
        mediaCount: { type: "integer" },
        qualityScore: { type: "float" },
        publishedAt: { type: "date" },
        updatedAt: { type: "date" },
      },
    },
  }
}

/** Corps indexé : le document commun plus les champs dérivés pour le tri. */
export function toOpenSearchBody(
  document: ListingSearchDocument,
): Record<string, unknown> {
  return {
    ...document,
    surfaceOrLand: document.surface ?? document.landSurface,
  }
}
