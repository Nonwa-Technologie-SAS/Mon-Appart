import { serializeLocation } from "../../property"
import type { ListingView } from "../application/listing-query.service"
import type {
  ListingDetailRow,
  ListingSummaryRow,
} from "../infrastructure/listing.repository"
import type {
  ListingHistoryResponseDto,
  ListingResponseDto,
  ListingSummaryResponseDto,
  PriceResponseDto,
} from "./dto/listing-response.dto"

type Decimalish = { toString(): string } | null

const decimal = (value: Decimalish): string | null =>
  value === null ? null : value.toString()

function serializePrice(
  prices: ListingDetailRow["prices"] | ListingSummaryRow["prices"],
): PriceResponseDto | null {
  const price = prices[0]
  return price
    ? {
        amount: price.amount.toString(),
        currency: price.currency,
        period: price.period,
      }
    : null
}

export function serializeListing(view: ListingView): ListingResponseDto {
  const { row } = view
  const property = row.property
  const base: ListingResponseDto = {
    id: row.publicId,
    listingType: row.listingType,
    status: row.status,
    title: row.title,
    description: row.description,
    price: serializePrice(row.prices),
    property: {
      id: property.publicId,
      title: property.title,
      propertyType: property.propertyType,
      surface: decimal(property.surface),
      landSurface: decimal(property.landSurface),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      rooms: property.rooms,
      amenities: property.amenities.map((entry) => entry.amenity),
    },
    location: serializeLocation(property, view.mode),
    media: {
      count: property._count.media,
      coverUrl: property.media[0]?.url ?? null,
    },
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }
  if (view.mode === "public") return base
  return {
    ...base,
    relation: view.relation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeListingSummary(
  row: ListingSummaryRow,
  mode: "public" | "private",
): ListingSummaryResponseDto {
  const property = row.property
  return {
    id: row.publicId,
    listingType: row.listingType,
    title: row.title,
    price: serializePrice(row.prices),
    property: {
      id: property.publicId,
      propertyType: property.propertyType,
      surface: decimal(property.surface),
      landSurface: decimal(property.landSurface),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
    },
    location: serializeLocation(property, mode),
    coverUrl: property.media[0]?.url ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    ...(mode === "private"
      ? { status: row.status, expiresAt: row.expiresAt?.toISOString() ?? null }
      : {}),
  }
}

export function serializeHistory(history: {
  prices: Array<{
    amount: { toString(): string }
    currency: string
    period: PriceResponseDto["period"]
    validFrom: Date
    validTo: Date | null
  }>
  statuses: Array<{
    oldStatus: ListingResponseDto["status"] | null
    newStatus: ListingResponseDto["status"]
    reason: string | null
    createdAt: Date
    changedBy: { publicId: string } | null
  }>
}): ListingHistoryResponseDto {
  return {
    prices: history.prices.map((price) => ({
      amount: price.amount.toString(),
      currency: price.currency,
      period: price.period,
      validFrom: price.validFrom.toISOString(),
      validTo: price.validTo?.toISOString() ?? null,
    })),
    statuses: history.statuses.map((entry) => ({
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      changedBy: entry.changedBy?.publicId ?? null,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}
