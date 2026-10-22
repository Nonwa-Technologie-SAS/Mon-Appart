import { Injectable } from "@nestjs/common"
import type { ListingType } from "@mon-appart/types"

import { DatabaseService } from "../../../../database/database.service"
import { Prisma } from "../../../../generated/prisma/client"
import { PUBLIC_MEDIA, publicCoordinates } from "../../../property"
import type { ListingSearchSource } from "../../domain/listing-search-document"

const sourceSelect = {
  id: true,
  publicId: true,
  status: true,
  listingType: true,
  title: true,
  description: true,
  publishedAt: true,
  updatedAt: true,
  prices: {
    where: { validTo: null },
    select: { amount: true, currency: true, period: true },
  },
  property: {
    select: {
      publicId: true,
      description: true,
      surface: true,
      landSurface: true,
      bedrooms: true,
      bathrooms: true,
      latitude: true,
      longitude: true,
      locationVisibility: true,
      updatedAt: true,
      propertyType: { select: { code: true, name: true } },
      neighborhood: {
        select: {
          id: true,
          code: true,
          name: true,
          commune: {
            select: {
              code: true,
              name: true,
              city: { select: { code: true, name: true } },
            },
          },
        },
      },
      amenities: {
        select: { amenity: { select: { code: true, name: true } } },
        orderBy: { amenity: { code: "asc" } },
      },
      _count: { select: { media: { where: PUBLIC_MEDIA } } },
    },
  },
} satisfies Prisma.ListingSelect

type SourceRow = Prisma.ListingGetPayload<{ select: typeof sourceSelect }>

export interface IndexableListing {
  internalId: bigint
  source: ListingSearchSource
}

/** Annonces indexables : non supprimées, d'un bien non supprimé. */
const INDEXABLE = {
  deletedAt: null,
  property: { deletedAt: null },
} satisfies Prisma.ListingWhereInput

const toNumber = (value: { toString(): string } | null): number | null =>
  value === null ? null : Number(value.toString())

/** Lecture des tables métier pour construire les documents de recherche. */
@Injectable()
export class SearchSourceRepository {
  constructor(private readonly db: DatabaseService) {}

  async byListingPublicId(publicId: string): Promise<IndexableListing | null> {
    const row = await this.db.client.listing.findFirst({
      where: { publicId, ...INDEXABLE },
      select: sourceSelect,
    })
    return row ? toIndexable(row) : null
  }

  async listingPublicIdsOfProperty(
    propertyPublicId: string,
  ): Promise<string[]> {
    const rows = await this.db.client.listing.findMany({
      where: { property: { publicId: propertyPublicId } },
      select: { publicId: true },
    })
    return rows.map((row) => row.publicId)
  }

  /** Lot suivant par id croissant : mémoire bornée, reprise possible. */
  async batch(afterId: bigint, size: number): Promise<IndexableListing[]> {
    const rows = await this.db.client.listing.findMany({
      where: { id: { gt: afterId }, ...INDEXABLE },
      orderBy: { id: "asc" },
      take: size,
      select: sourceSelect,
    })
    return rows.map(toIndexable)
  }

  countIndexable(): Promise<number> {
    return this.db.client.listing.count({ where: INDEXABLE })
  }
}

function toIndexable(row: SourceRow): IndexableListing {
  const property = row.property
  const commune = property.neighborhood.commune
  const point = publicCoordinates(
    property.locationVisibility,
    toNumber(property.latitude),
    toNumber(property.longitude),
  )
  const price = row.prices[0]
  return {
    internalId: row.id,
    source: {
      listingId: row.publicId,
      propertyId: property.publicId,
      status: row.status,
      listingType: row.listingType as ListingType,
      title: row.title,
      description: row.description,
      propertyDescription: property.description,
      propertyType: property.propertyType,
      city: commune.city,
      commune: { code: commune.code, name: commune.name },
      neighborhood: {
        id: property.neighborhood.id,
        code: property.neighborhood.code,
        name: property.neighborhood.name,
      },
      publishedPoint: point,
      price: price
        ? {
            amount: Number(price.amount.toString()),
            currency: price.currency,
            period: price.period,
          }
        : null,
      surface: toNumber(property.surface),
      landSurface: toNumber(property.landSurface),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      amenities: property.amenities.map((entry) => entry.amenity),
      mediaCount: property._count.media,
      publishedAt: row.publishedAt,
      updatedAt:
        row.updatedAt > property.updatedAt ? row.updatedAt : property.updatedAt,
    },
  }
}
