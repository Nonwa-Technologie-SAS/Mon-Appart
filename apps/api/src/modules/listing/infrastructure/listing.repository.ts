import { Injectable } from "@nestjs/common"

import {
  DatabaseService,
  type Db,
  type Tx,
} from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import type {
  ListingStatus,
  ListingType,
  PricePeriod,
} from "../../../generated/prisma/enums"
import {
  COVER_MEDIA,
  MANAGING_RELATIONS,
  nearCondition,
  PUBLIC_MEDIA,
} from "../../property"

const CURRENT_PRICE = {
  where: { validTo: null },
  select: { amount: true, currency: true, period: true, validFrom: true },
} as const

const neighborhoodSelect = {
  code: true,
  name: true,
  commune: { select: { code: true, name: true } },
} satisfies Prisma.NeighborhoodSelect

/** État relu sous verrou avant une écriture : annonce, bien et prix courant. */
export const listingStateSelect = {
  id: true,
  publicId: true,
  propertyId: true,
  createdById: true,
  listingType: true,
  status: true,
  title: true,
  description: true,
  publishedAt: true,
  expiresAt: true,
  deletedAt: true,
  prices: CURRENT_PRICE,
  property: {
    select: {
      publicId: true,
      status: true,
      deletedAt: true,
      title: true,
      surface: true,
      landSurface: true,
      bedrooms: true,
      bathrooms: true,
      rooms: true,
      floor: true,
      totalFloors: true,
      latitude: true,
      longitude: true,
      attributes: true,
      propertyType: { select: { category: true } },
    },
  },
} satisfies Prisma.ListingSelect

export type ListingStateRow = Prisma.ListingGetPayload<{
  select: typeof listingStateSelect
}>

/** Fiche annonce : bien résumé, prix courant, localisation, équipements, médias. */
export const listingDetailSelect = {
  id: true,
  publicId: true,
  propertyId: true,
  listingType: true,
  status: true,
  title: true,
  description: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  prices: CURRENT_PRICE,
  property: {
    select: {
      publicId: true,
      title: true,
      status: true,
      deletedAt: true,
      surface: true,
      landSurface: true,
      bedrooms: true,
      bathrooms: true,
      rooms: true,
      address: true,
      latitude: true,
      longitude: true,
      locationVisibility: true,
      propertyType: { select: { code: true, name: true, category: true } },
      neighborhood: { select: neighborhoodSelect },
      amenities: {
        select: {
          amenity: { select: { code: true, name: true, category: true } },
        },
        orderBy: { amenity: { code: "asc" } },
      },
      media: {
        where: COVER_MEDIA,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
        select: { url: true },
      },
      _count: { select: { media: { where: PUBLIC_MEDIA } } },
    },
  },
} satisfies Prisma.ListingSelect

export type ListingDetailRow = Prisma.ListingGetPayload<{
  select: typeof listingDetailSelect
}>

export const listingSummarySelect = {
  id: true,
  publicId: true,
  listingType: true,
  status: true,
  title: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  prices: CURRENT_PRICE,
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
      propertyType: { select: { code: true, name: true, category: true } },
      neighborhood: { select: neighborhoodSelect },
      media: {
        where: COVER_MEDIA,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
  },
} satisfies Prisma.ListingSelect

export type ListingSummaryRow = Prisma.ListingGetPayload<{
  select: typeof listingSummarySelect
}>

export interface ListingSearchFilters {
  scope: "public" | "mine" | "all"
  actorId: bigint | null
  status?: ListingStatus
  listingType?: ListingType
  propertyTypeId?: number
  neighborhoodIds?: readonly number[]
  minPrice?: number
  maxPrice?: number
  period?: PricePeriod
  minSurface?: number
  maxSurface?: number
  minBedrooms?: number
  minBathrooms?: number
  near?: { latitude: number; longitude: number; radiusMeters: number }
  cursorPublicId?: string
  limit: number
}

const MANAGING_SQL = Prisma.join(
  MANAGING_RELATIONS.map((relation) => Prisma.sql`${relation}::ownership_type`),
)

@Injectable()
export class ListingRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Verrou de ligne : sérialise statut et prix d'une même annonce. */
  async lockByPublicId(publicId: string, tx: Tx): Promise<bigint | null> {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM listings WHERE public_id = ${publicId}::uuid FOR UPDATE
    `
    return rows[0]?.id ?? null
  }

  findState(id: bigint, db: Db): Promise<ListingStateRow | null> {
    return db.listing.findUnique({ where: { id }, select: listingStateSelect })
  }

  findDetail(publicId: string, db: Db = this.db.client) {
    return db.listing.findUnique({
      where: { publicId },
      select: listingDetailSelect,
    })
  }

  findPropertyForListing(publicId: string, db: Db = this.db.client) {
    return db.property.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        title: true,
        status: true,
        deletedAt: true,
      },
    })
  }

  async create(
    data: {
      propertyId: bigint
      createdById: bigint
      listingType: ListingType
      title: string
      description: string | null
    },
    price: { amount: number; currency: string; period: PricePeriod } | null,
    tx: Tx,
  ): Promise<{ id: bigint; publicId: string }> {
    const listing = await tx.listing.create({
      data: { ...data, status: "DRAFT" },
      select: { id: true, publicId: true },
    })
    if (price) {
      await tx.listingPrice.create({
        data: { listingId: listing.id, ...price, validFrom: new Date() },
      })
    }
    await tx.listingStatusHistory.create({
      data: {
        listingId: listing.id,
        newStatus: "DRAFT",
        changedById: data.createdById,
      },
    })
    return listing
  }

  async update(
    id: bigint,
    data: Prisma.ListingUncheckedUpdateInput,
    tx: Tx,
  ): Promise<void> {
    await tx.listing.update({ where: { id }, data })
  }

  async addHistory(
    entry: {
      listingId: bigint
      oldStatus: ListingStatus
      newStatus: ListingStatus
      changedById: bigint | null
      reason: string | null
    },
    tx: Tx,
  ): Promise<void> {
    await tx.listingStatusHistory.create({ data: entry })
  }

  async closePrice(priceListingId: bigint, at: Date, tx: Tx): Promise<number> {
    const result = await tx.listingPrice.updateMany({
      where: { listingId: priceListingId, validTo: null },
      data: { validTo: at },
    })
    return result.count
  }

  async insertPrice(
    listingId: bigint,
    price: { amount: number; currency: string; period: PricePeriod },
    validFrom: Date,
    tx: Tx,
  ): Promise<void> {
    await tx.listingPrice.create({ data: { listingId, ...price, validFrom } })
  }

  priceHistory(listingId: bigint) {
    return this.db.client.listingPrice.findMany({
      where: { listingId },
      orderBy: [{ validFrom: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        amount: true,
        currency: true,
        period: true,
        validFrom: true,
        validTo: true,
      },
    })
  }

  statusHistory(listingId: bigint) {
    return this.db.client.listingStatusHistory.findMany({
      where: { listingId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        oldStatus: true,
        newStatus: true,
        reason: true,
        createdAt: true,
        changedBy: { select: { publicId: true } },
      },
    })
  }

  /** Recherche SQL (prix courant, rayon PostGIS, keyset) puis hydratation en une requête. */
  async search(filters: ListingSearchFilters): Promise<ListingSummaryRow[]> {
    const publicScope = filters.scope === "public"
    const conditions: Prisma.Sql[] = [Prisma.sql`l.deleted_at IS NULL`]

    if (publicScope) {
      conditions.push(
        Prisma.sql`l.status = 'PUBLISHED' AND p.status = 'ACTIVE' AND p.deleted_at IS NULL`,
      )
    } else {
      conditions.push(Prisma.sql`p.deleted_at IS NULL`)
      if (filters.status) {
        conditions.push(
          Prisma.sql`l.status = ${filters.status}::listing_status`,
        )
      }
    }
    if (filters.scope === "mine") {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM property_ownerships o
        WHERE o.property_id = l.property_id AND o.owner_id = ${filters.actorId}
          AND o.is_current AND o.ownership_type IN (${MANAGING_SQL})
      )`)
    }
    if (filters.listingType) {
      conditions.push(
        Prisma.sql`l.listing_type = ${filters.listingType}::listing_type`,
      )
    }
    if (filters.propertyTypeId !== undefined) {
      conditions.push(
        Prisma.sql`p.property_type_id = ${filters.propertyTypeId}`,
      )
    }
    if (filters.neighborhoodIds) {
      if (filters.neighborhoodIds.length === 0) return []
      conditions.push(
        Prisma.sql`p.neighborhood_id IN (${Prisma.join([...filters.neighborhoodIds])})`,
      )
    }
    if (filters.minPrice !== undefined) {
      conditions.push(Prisma.sql`lp.amount >= ${filters.minPrice}`)
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(Prisma.sql`lp.amount <= ${filters.maxPrice}`)
    }
    if (filters.period) {
      conditions.push(Prisma.sql`lp.period = ${filters.period}::price_period`)
    }
    if (filters.minSurface !== undefined) {
      conditions.push(
        Prisma.sql`COALESCE(p.surface, p.land_surface) >= ${filters.minSurface}`,
      )
    }
    if (filters.maxSurface !== undefined) {
      conditions.push(
        Prisma.sql`COALESCE(p.surface, p.land_surface) <= ${filters.maxSurface}`,
      )
    }
    if (filters.minBedrooms !== undefined) {
      conditions.push(Prisma.sql`p.bedrooms >= ${filters.minBedrooms}`)
    }
    if (filters.minBathrooms !== undefined) {
      conditions.push(Prisma.sql`p.bathrooms >= ${filters.minBathrooms}`)
    }
    if (filters.near) {
      conditions.push(nearCondition(filters.near, publicScope))
    }

    // Flux public trié par date de publication (index partiel dédié), sinon par création.
    const sortColumn = Prisma.raw(publicScope ? "published_at" : "created_at")
    if (filters.cursorPublicId) {
      conditions.push(Prisma.sql`(l.${sortColumn}, l.id) < (
        SELECT c.${sortColumn}, c.id FROM listings c
        WHERE c.public_id = ${filters.cursorPublicId}::uuid
      )`)
    }

    const rows = await this.db.client.$queryRaw<Array<{ id: bigint }>>`
      SELECT l.id FROM listings l
      JOIN properties p ON p.id = l.property_id
      LEFT JOIN listing_prices lp ON lp.listing_id = l.id AND lp.valid_to IS NULL
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY l.${sortColumn} DESC, l.id DESC
      LIMIT ${filters.limit}
    `
    if (rows.length === 0) return []
    const ids = rows.map((row) => row.id)
    const items = await this.db.client.listing.findMany({
      where: { id: { in: ids } },
      select: listingSummarySelect,
    })
    const byId = new Map(items.map((item) => [item.id, item]))
    return ids.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }
}
