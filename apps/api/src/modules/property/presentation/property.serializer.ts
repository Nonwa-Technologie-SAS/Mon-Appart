import type { LocationVisibility } from "../../../generated/prisma/enums"
import type { PropertyView } from "../application/property-query.service"
import { isAddressPublic, publicCoordinates } from "../domain/location-privacy"
import { missingForCompleteness } from "../domain/property-rules"
import type {
  PropertyDetailRow,
  PropertySummaryRow,
} from "../infrastructure/property.repository"
import type {
  PropertyLocationDto,
  PropertyResponseDto,
  PropertySummaryResponseDto,
} from "./dto/property-response.dto"

type Decimalish = { toString(): string } | null

const decimal = (value: Decimalish): string | null =>
  value === null ? null : value.toString()

const toNumber = (value: Decimalish): number | null =>
  value === null ? null : Number(value.toString())

interface LocationSource {
  latitude: Decimalish
  longitude: Decimalish
  locationVisibility: LocationVisibility
  neighborhood: {
    code: string
    name: string
    commune: { code: string; name: string }
  }
}

/**
 * Localisation exposée. La vue privée donne tout ; la vue publique applique
 * le choix de confidentialité du propriétaire.
 */
export function serializeLocation(
  source: LocationSource & { address?: string | null },
  mode: "public" | "private",
): PropertyLocationDto {
  const latitude = toNumber(source.latitude)
  const longitude = toNumber(source.longitude)
  const commune = {
    code: source.neighborhood.commune.code,
    name: source.neighborhood.commune.name,
  }
  const neighborhood = {
    code: source.neighborhood.code,
    name: source.neighborhood.name,
  }
  if (mode === "private") {
    return {
      commune,
      neighborhood,
      latitude,
      longitude,
      precision: latitude === null ? "NONE" : "EXACT",
      address: source.address ?? null,
    }
  }
  const coordinates = publicCoordinates(
    source.locationVisibility,
    latitude,
    longitude,
  )
  return {
    commune,
    neighborhood,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    precision: coordinates?.precision ?? "NONE",
    address: isAddressPublic(source.locationVisibility)
      ? (source.address ?? null)
      : null,
  }
}

export function serializeProperty(view: PropertyView): PropertyResponseDto {
  const row = view.row
  const base: PropertyResponseDto = {
    id: row.publicId,
    title: row.title,
    description: row.description,
    propertyType: row.propertyType,
    location: serializeLocation(row, view.mode),
    surface: decimal(row.surface),
    landSurface: decimal(row.landSurface),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    rooms: row.rooms,
    floor: row.floor,
    totalFloors: row.totalFloors,
    yearBuilt: row.yearBuilt,
    attributes: (row.attributes ?? {}) as Record<string, unknown>,
    amenities: row.amenities.map((entry) => entry.amenity),
    media: { count: row._count.media, coverUrl: row.media[0]?.url ?? null },
    listings: row.listings.map((listing) => {
      const price = listing.prices[0]
      return {
        id: listing.publicId,
        listingType: listing.listingType,
        title: listing.title,
        amount: price ? price.amount.toString() : null,
        currency: price?.currency ?? null,
        period: price?.period ?? null,
      }
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
  if (view.mode === "public") return base

  const missing = missingForCompleteness(detailCharacteristics(row))
  return {
    ...base,
    status: row.status,
    locationVisibility: row.locationVisibility,
    relation: view.relation,
    completeness: { complete: missing.length === 0, missing },
  }
}

export function serializePropertySummary(
  row: PropertySummaryRow,
  mode: "public" | "private",
): PropertySummaryResponseDto {
  return {
    id: row.publicId,
    title: row.title,
    propertyType: row.propertyType,
    location: serializeLocation(row, mode),
    surface: decimal(row.surface),
    landSurface: decimal(row.landSurface),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    coverUrl: row.media[0]?.url ?? null,
    ...(mode === "private" ? { status: row.status } : {}),
    createdAt: row.createdAt.toISOString(),
  }
}

function detailCharacteristics(row: PropertyDetailRow) {
  return {
    category: row.propertyType.category,
    title: row.title,
    surface: toNumber(row.surface),
    landSurface: toNumber(row.landSurface),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    rooms: row.rooms,
    floor: row.floor,
    totalFloors: row.totalFloors,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    attributes: (row.attributes ?? {}) as Record<string, unknown>,
  }
}
