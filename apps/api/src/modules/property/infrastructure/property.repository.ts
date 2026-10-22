import { Injectable } from "@nestjs/common"

import {
  DatabaseService,
  type Db,
  type Tx,
} from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import type {
  ListingStatus,
  OwnershipType,
  PropertyStatus,
} from "../../../generated/prisma/enums"
import {
  APPROXIMATE_DECIMALS,
  APPROXIMATE_MAX_SHIFT_METERS,
} from "../domain/location-privacy"
import { MANAGING_RELATIONS } from "../domain/property-access"

/** Annonces « en cours » : celles qui bloquent un retrait du bien. */
export const LIVE_LISTING_STATUSES: readonly ListingStatus[] = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
]

/** Médias exposés publiquement : prêts, publics, non supprimés (documents exclus, toujours privés). */
export const PUBLIC_MEDIA: Prisma.MediaWhereInput = {
  deletedAt: null,
  status: "READY",
  visibility: "PUBLIC",
}

/** Couverture : première photo publique (plate ou 360°) ayant une URL CDN. */
export const COVER_MEDIA: Prisma.MediaWhereInput = {
  ...PUBLIC_MEDIA,
  type: { in: ["IMAGE", "IMAGE_360"] },
  url: { not: null },
}

const locationSelect = {
  code: true,
  name: true,
  commune: { select: { code: true, name: true } },
} satisfies Prisma.NeighborhoodSelect

/** Projection d'une fiche bien (détail). Une requête par relation, pas de N+1. */
export const propertyDetailSelect = {
  id: true,
  publicId: true,
  title: true,
  description: true,
  surface: true,
  landSurface: true,
  bedrooms: true,
  bathrooms: true,
  rooms: true,
  floor: true,
  totalFloors: true,
  yearBuilt: true,
  address: true,
  latitude: true,
  longitude: true,
  locationVisibility: true,
  attributes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  propertyType: { select: { code: true, name: true, category: true } },
  neighborhood: { select: locationSelect },
  amenities: {
    select: { amenity: { select: { code: true, name: true, category: true } } },
    orderBy: { amenity: { code: "asc" } },
  },
  media: {
    where: COVER_MEDIA,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 1,
    select: { url: true },
  },
  _count: { select: { media: { where: PUBLIC_MEDIA } } },
  listings: {
    where: { status: "PUBLISHED", deletedAt: null },
    orderBy: { publishedAt: "desc" },
    select: {
      publicId: true,
      listingType: true,
      title: true,
      prices: {
        where: { validTo: null },
        select: { amount: true, currency: true, period: true },
      },
    },
  },
} satisfies Prisma.PropertySelect

export type PropertyDetailRow = Prisma.PropertyGetPayload<{
  select: typeof propertyDetailSelect
}>

/** Projection d'un élément de liste : pas de description ni d'équipements. */
export const propertySummarySelect = {
  id: true,
  publicId: true,
  title: true,
  surface: true,
  landSurface: true,
  bedrooms: true,
  bathrooms: true,
  latitude: true,
  longitude: true,
  locationVisibility: true,
  status: true,
  createdAt: true,
  propertyType: { select: { code: true, name: true, category: true } },
  neighborhood: { select: locationSelect },
  media: {
    where: COVER_MEDIA,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.PropertySelect

export type PropertySummaryRow = Prisma.PropertyGetPayload<{
  select: typeof propertySummarySelect
}>

/** État modifiable, relu sous verrou avant une mise à jour. */
export const propertyStateSelect = {
  id: true,
  publicId: true,
  propertyTypeId: true,
  neighborhoodId: true,
  title: true,
  description: true,
  surface: true,
  landSurface: true,
  bedrooms: true,
  bathrooms: true,
  rooms: true,
  floor: true,
  totalFloors: true,
  yearBuilt: true,
  address: true,
  latitude: true,
  longitude: true,
  locationVisibility: true,
  attributes: true,
  status: true,
  deletedAt: true,
  propertyType: { select: { code: true, category: true } },
} satisfies Prisma.PropertySelect

export type PropertyStateRow = Prisma.PropertyGetPayload<{
  select: typeof propertyStateSelect
}>

export interface PropertySearchFilters {
  scope: "public" | "mine" | "all"
  actorId: bigint | null
  status?: PropertyStatus
  propertyTypeId?: number
  neighborhoodIds?: readonly number[]
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
export class PropertyRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Verrouille la ligne pour sérialiser les écritures concurrentes sur un bien. */
  async lockByPublicId(publicId: string, tx: Tx): Promise<bigint | null> {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM properties WHERE public_id = ${publicId}::uuid FOR UPDATE
    `
    return rows[0]?.id ?? null
  }

  findState(id: bigint, db: Db): Promise<PropertyStateRow | null> {
    return db.property.findUnique({
      where: { id },
      select: propertyStateSelect,
    })
  }

  findStateByPublicId(publicId: string, db: Db = this.db.client) {
    return db.property.findUnique({
      where: { publicId },
      select: propertyStateSelect,
    })
  }

  async relationOf(
    propertyId: bigint,
    userId: bigint,
    db: Db = this.db.client,
  ): Promise<OwnershipType | null> {
    const ownership = await db.propertyOwnership.findFirst({
      where: { propertyId, ownerId: userId, isCurrent: true },
      select: { ownershipType: true },
    })
    return ownership?.ownershipType ?? null
  }

  findDetail(publicId: string, db: Db = this.db.client) {
    return db.property.findUnique({
      where: { publicId },
      select: propertyDetailSelect,
    })
  }

  async create(
    data: Prisma.PropertyUncheckedCreateInput,
    owner: { userId: bigint; ownershipType: OwnershipType },
    amenityIds: readonly number[],
    tx: Tx,
  ): Promise<{ id: bigint; publicId: string }> {
    const property = await tx.property.create({
      data,
      select: { id: true, publicId: true },
    })
    await tx.propertyOwnership.create({
      data: {
        propertyId: property.id,
        ownerId: owner.userId,
        ownershipType: owner.ownershipType,
      },
    })
    if (amenityIds.length > 0) {
      await tx.propertyAmenity.createMany({
        data: amenityIds.map((amenityId) => ({
          propertyId: property.id,
          amenityId,
        })),
        skipDuplicates: true,
      })
    }
    return property
  }

  async update(
    id: bigint,
    data: Prisma.PropertyUncheckedUpdateInput,
    tx: Tx,
  ): Promise<void> {
    await tx.property.update({ where: { id }, data })
  }

  countLiveListings(propertyId: bigint, db: Db): Promise<number> {
    return db.listing.count({
      where: {
        propertyId,
        deletedAt: null,
        status: { in: [...LIVE_LISTING_STATUSES] },
      },
    })
  }

  /** Suppression logique du bien et de ses annonces non supprimées. */
  async softDelete(id: bigint, at: Date, tx: Tx): Promise<number> {
    const listings = await tx.listing.updateMany({
      where: { propertyId: id, deletedAt: null },
      data: { deletedAt: at },
    })
    await tx.property.update({ where: { id }, data: { deletedAt: at } })
    return listings.count
  }

  async amenityIds(propertyId: bigint, db: Db): Promise<number[]> {
    const rows = await db.propertyAmenity.findMany({
      where: { propertyId },
      select: { amenityId: true },
    })
    return rows.map((row) => row.amenityId)
  }

  async replaceAmenities(
    propertyId: bigint,
    added: readonly number[],
    removed: readonly number[],
    tx: Tx,
  ): Promise<void> {
    if (removed.length > 0) {
      await tx.propertyAmenity.deleteMany({
        where: { propertyId, amenityId: { in: [...removed] } },
      })
    }
    if (added.length > 0) {
      await tx.propertyAmenity.createMany({
        data: added.map((amenityId) => ({ propertyId, amenityId })),
        skipDuplicates: true,
      })
    }
    await tx.property.update({
      where: { id: propertyId },
      data: { updatedAt: new Date() },
    })
  }

  /** Vrai si le curseur désigne un bien existant (même supprimé). */
  async cursorExists(publicId: string): Promise<boolean> {
    const count = await this.db.client.property.count({ where: { publicId } })
    return count > 0
  }

  /**
   * Recherche en SQL (filtres, rayon PostGIS, curseur keyset) qui ne renvoie
   * que des identifiants, puis hydratation par une seule requête Prisma.
   */
  async search(filters: PropertySearchFilters): Promise<PropertySummaryRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`p.deleted_at IS NULL`]

    if (filters.scope === "public") {
      conditions.push(Prisma.sql`p.status = 'ACTIVE'`)
    } else if (filters.status) {
      conditions.push(Prisma.sql`p.status = ${filters.status}::property_status`)
    }
    if (filters.scope === "mine") {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM property_ownerships o
        WHERE o.property_id = p.id AND o.owner_id = ${filters.actorId}
          AND o.is_current AND o.ownership_type IN (${MANAGING_SQL})
      )`)
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
      conditions.push(nearCondition(filters.near, filters.scope === "public"))
    }
    if (filters.cursorPublicId) {
      conditions.push(Prisma.sql`(p.created_at, p.id) < (
        SELECT c.created_at, c.id FROM properties c
        WHERE c.public_id = ${filters.cursorPublicId}::uuid
      )`)
    }

    const rows = await this.db.client.$queryRaw<Array<{ id: bigint }>>`
      SELECT p.id FROM properties p
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${filters.limit}
    `
    if (rows.length === 0) return []
    const ids = rows.map((row) => row.id)
    const items = await this.db.client.property.findMany({
      where: { id: { in: ids } },
      select: propertySummarySelect,
    })
    const byId = new Map(items.map((item) => [item.id, item]))
    return ids.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }
}

/**
 * Rayon autour d'un point, sur `geo_point` (index GIST). En recherche publique,
 * le filtre porte sur la position publiée : arrondie pour APPROXIMATE (sinon des
 * rayons successifs retrouveraient la position réelle), absente pour HIDDEN.
 */
export function nearCondition(
  near: { latitude: number; longitude: number; radiusMeters: number },
  publicSearch: boolean,
  alias = "p",
): Prisma.Sql {
  const column = Prisma.raw(`${alias}.geo_point`)
  const origin = Prisma.sql`ST_SetSRID(ST_MakePoint(${near.longitude}::float8, ${near.latitude}::float8), 4326)::geography`
  const within = Prisma.sql`ST_DWithin(${column}, ${origin}, ${near.radiusMeters}::float8)`
  if (!publicSearch) return within

  const visibility = Prisma.raw(`${alias}.location_visibility`)
  const roundedPoint = roundedPointSql(alias)
  return Prisma.sql`(
    (${visibility} = 'EXACT' AND ${within})
    OR (
      ${visibility} = 'APPROXIMATE'
      AND ST_DWithin(${column}, ${origin}, ${near.radiusMeters + APPROXIMATE_MAX_SHIFT_METERS}::float8)
      AND ST_DWithin(${roundedPoint}, ${origin}, ${near.radiusMeters}::float8)
    )
  )`
}

function roundedPointSql(alias: string): Prisma.Sql {
  const factor = Prisma.raw(String(10 ** APPROXIMATE_DECIMALS))
  // floor(x + 0.5) reproduit Math.round, y compris pour les longitudes négatives.
  const rounded = (field: string) =>
    Prisma.sql`(floor(${Prisma.raw(`${alias}.${field}`)} * ${factor} + 0.5) / ${factor})::float8`
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${rounded("longitude")}, ${rounded("latitude")}), 4326)::geography`
}

/**
 * Position publiée d'un bien, en geography : exacte (EXACT), arrondie
 * (APPROXIMATE) ou NULL (HIDDEN). À utiliser pour toute distance exposée.
 */
export function publishedPointSql(alias = "p"): Prisma.Sql {
  const visibility = Prisma.raw(`${alias}.location_visibility`)
  return Prisma.sql`(CASE
    WHEN ${visibility} = 'EXACT' THEN ${Prisma.raw(`${alias}.geo_point`)}
    WHEN ${visibility} = 'APPROXIMATE' AND ${Prisma.raw(`${alias}.geo_point`)} IS NOT NULL THEN ${roundedPointSql(alias)}
  END)`
}
