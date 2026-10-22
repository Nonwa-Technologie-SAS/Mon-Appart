import { Injectable } from "@nestjs/common"
import type { ListingType, SearchResultItem } from "@mon-appart/types"

import { DatabaseService } from "../../../../database/database.service"
import { Prisma } from "../../../../generated/prisma/client"
import { COVER_MEDIA, publicCoordinates } from "../../../property"
import type { EngineHit } from "../../domain/search-engine"

const resultSelect = {
  publicId: true,
  title: true,
  listingType: true,
  publishedAt: true,
  prices: {
    where: { validTo: null },
    select: { amount: true, currency: true, period: true },
  },
  property: {
    select: {
      publicId: true,
      surface: true,
      landSurface: true,
      bedrooms: true,
      bathrooms: true,
      latitude: true,
      longitude: true,
      locationVisibility: true,
      propertyType: { select: { code: true, name: true } },
      neighborhood: {
        select: {
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
      media: {
        where: COVER_MEDIA,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
  },
} satisfies Prisma.ListingSelect

type ResultRow = Prisma.ListingGetPayload<{ select: typeof resultSelect }>

const toNumber = (value: { toString(): string } | null): number | null =>
  value === null ? null : Number(value.toString())

/**
 * Construit les résultats depuis PostgreSQL, quel que soit le moteur : une
 * annonce dépubliée ou supprimée depuis l'indexation est écartée ici. Une
 * seule requête (pas de N+1), ordre du moteur conservé.
 */
@Injectable()
export class SearchHydrator {
  constructor(private readonly db: DatabaseService) {}

  async hydrate(
    hits: readonly EngineHit[],
    options: { withScore: boolean },
  ): Promise<SearchResultItem[]> {
    if (hits.length === 0) return []
    const rows = await this.db.client.listing.findMany({
      where: {
        publicId: { in: hits.map((hit) => hit.listingId) },
        status: "PUBLISHED",
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        property: { status: "ACTIVE", deletedAt: null },
      },
      select: resultSelect,
    })
    const byId = new Map(rows.map((row) => [row.publicId, row]))
    return hits.flatMap((hit) => {
      const row = byId.get(hit.listingId)
      return row ? [serialize(row, hit, options.withScore)] : []
    })
  }
}

function serialize(
  row: ResultRow,
  hit: EngineHit,
  withScore: boolean,
): SearchResultItem {
  const property = row.property
  const commune = property.neighborhood.commune
  const coordinates = publicCoordinates(
    property.locationVisibility,
    toNumber(property.latitude),
    toNumber(property.longitude),
  )
  const price = row.prices[0]
  return {
    listingId: row.publicId,
    propertyId: property.publicId,
    title: row.title,
    listingType: row.listingType as ListingType,
    propertyType: property.propertyType,
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
    location: {
      city: { code: commune.city.code, name: commune.city.name },
      commune: { code: commune.code, name: commune.name },
      neighborhood: {
        code: property.neighborhood.code,
        name: property.neighborhood.name,
      },
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      precision: coordinates?.precision ?? "NONE",
    },
    mainImage: property.media[0]?.url ?? null,
    score:
      withScore && hit.score !== null
        ? Math.round(hit.score * 10_000) / 10_000
        : null,
    distance:
      hit.distanceMeters === null
        ? null
        : { value: Math.round(hit.distanceMeters / 100) / 10, unit: "km" },
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
  }
}
