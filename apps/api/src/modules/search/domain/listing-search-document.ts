import type { ListingType } from "@mon-appart/types"

/** Incrémenté à chaque changement de forme du document indexé. */
export const SEARCH_DOCUMENT_SCHEMA_VERSION = 1

/**
 * Document dénormalisé d'une annonce, commun à la projection PostgreSQL et à
 * l'index OpenSearch. Il ne contient que des données déjà publiques : la
 * position est la position publiée (arrondie ou absente), jamais l'adresse.
 */
export interface ListingSearchDocument {
  schemaVersion: number
  listingId: string
  propertyId: string
  status: string
  listingType: ListingType
  title: string
  description: string
  propertyType: { code: string; name: string }
  location: {
    cityCode: string
    cityName: string
    communeCode: string
    communeName: string
    neighborhoodId: number
    neighborhoodCode: string
    neighborhoodName: string
    point: { lat: number; lon: number } | null
    precision: "EXACT" | "APPROXIMATE" | "NONE"
  }
  price: { amount: number; currency: string; period: string } | null
  surface: number | null
  landSurface: number | null
  bedrooms: number | null
  bathrooms: number | null
  amenities: { code: string; name: string }[]
  mediaCount: number
  qualityScore: number
  publishedAt: string | null
  updatedAt: string
}

/** Données sources lues dans les tables métier. */
export interface ListingSearchSource {
  listingId: string
  propertyId: string
  status: string
  listingType: ListingType
  title: string
  description: string | null
  propertyDescription: string | null
  propertyType: { code: string; name: string }
  city: { code: string; name: string }
  commune: { code: string; name: string }
  neighborhood: { id: number; code: string; name: string }
  publishedPoint: {
    latitude: number
    longitude: number
    precision: "EXACT" | "APPROXIMATE"
  } | null
  price: { amount: number; currency: string; period: string } | null
  surface: number | null
  landSurface: number | null
  bedrooms: number | null
  bathrooms: number | null
  amenities: { code: string; name: string }[]
  mediaCount: number
  publishedAt: Date | null
  updatedAt: Date
}

/**
 * Complétude de 0 à 1 : description, photos, équipements, surface, position.
 * Signal de qualité éditoriale, pas de confiance (Trust est un autre module).
 */
export function computeQualityScore(source: ListingSearchSource): number {
  const description = (
    source.description ??
    source.propertyDescription ??
    ""
  ).trim().length
  const score =
    Math.min(description / 300, 1) * 0.25 +
    Math.min(source.mediaCount / 5, 1) * 0.35 +
    Math.min(source.amenities.length / 5, 1) * 0.15 +
    (source.surface !== null || source.landSurface !== null ? 0.1 : 0) +
    (source.publishedPoint ? 0.15 : 0)
  return Math.round(Math.min(1, score) * 1000) / 1000
}

export function buildListingSearchDocument(
  source: ListingSearchSource,
): ListingSearchDocument {
  return {
    schemaVersion: SEARCH_DOCUMENT_SCHEMA_VERSION,
    listingId: source.listingId,
    propertyId: source.propertyId,
    status: source.status,
    listingType: source.listingType,
    title: source.title,
    description: source.description ?? source.propertyDescription ?? "",
    propertyType: source.propertyType,
    location: {
      cityCode: source.city.code,
      cityName: source.city.name,
      communeCode: source.commune.code,
      communeName: source.commune.name,
      neighborhoodId: source.neighborhood.id,
      neighborhoodCode: source.neighborhood.code,
      neighborhoodName: source.neighborhood.name,
      point: source.publishedPoint
        ? {
            lat: source.publishedPoint.latitude,
            lon: source.publishedPoint.longitude,
          }
        : null,
      precision: source.publishedPoint?.precision ?? "NONE",
    },
    price: source.price,
    surface: source.surface,
    landSurface: source.landSurface,
    bedrooms: source.bedrooms,
    bathrooms: source.bathrooms,
    amenities: source.amenities,
    mediaCount: source.mediaCount,
    qualityScore: computeQualityScore(source),
    publishedAt: source.publishedAt?.toISOString() ?? null,
    updatedAt: source.updatedAt.toISOString(),
  }
}
