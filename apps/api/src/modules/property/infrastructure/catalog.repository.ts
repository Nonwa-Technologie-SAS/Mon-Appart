import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../database/database.service"
import type {
  AmenityCategory,
  PropertyCategory,
} from "../../../generated/prisma/enums"

const CACHE_TTL_MS = 5 * 60_000

export interface PropertyTypeEntry {
  id: number
  code: string
  name: string
  category: PropertyCategory
  isActive: boolean
}

export interface AmenityEntry {
  id: number
  code: string
  name: string
  category: AmenityCategory
}

export interface NeighborhoodEntry {
  id: number
  code: string
  name: string
  communeId: number
  communeCode: string
  communeName: string
  cityId: number
  cityCode: string
  cityName: string
}

interface Snapshot {
  expiresAt: number
  typesByCode: Map<string, PropertyTypeEntry>
  amenitiesByCode: Map<string, AmenityEntry>
  neighborhoods: NeighborhoodEntry[]
}

/**
 * Référentiels (types, équipements, quartiers) : quelques dizaines de lignes
 * qui changent par migration ou seed. Gardés 5 min en mémoire par instance.
 */
@Injectable()
export class CatalogRepository {
  private snapshot: Snapshot | null = null

  constructor(private readonly db: DatabaseService) {}

  async propertyType(code: string): Promise<PropertyTypeEntry | null> {
    return (await this.load()).typesByCode.get(code) ?? null
  }

  async propertyTypes(): Promise<PropertyTypeEntry[]> {
    return [...(await this.load()).typesByCode.values()]
  }

  async amenities(): Promise<AmenityEntry[]> {
    return [...(await this.load()).amenitiesByCode.values()]
  }

  /** `null` si au moins un code est inconnu. */
  async amenitiesByCodes(
    codes: readonly string[],
  ): Promise<AmenityEntry[] | null> {
    const { amenitiesByCode } = await this.load()
    const entries: AmenityEntry[] = []
    for (const code of codes) {
      const entry = amenitiesByCode.get(code)
      if (!entry) return null
      entries.push(entry)
    }
    return entries
  }

  async neighborhood(
    communeCode: string,
    neighborhoodCode: string,
  ): Promise<NeighborhoodEntry | null> {
    const { neighborhoods } = await this.load()
    return (
      neighborhoods.find(
        (entry) =>
          entry.communeCode === communeCode && entry.code === neighborhoodCode,
      ) ?? null
    )
  }

  async neighborhoodIdsOfCommune(communeCode: string): Promise<number[]> {
    const { neighborhoods } = await this.load()
    return neighborhoods
      .filter((entry) => entry.communeCode === communeCode)
      .map((entry) => entry.id)
  }

  async neighborhoods(): Promise<NeighborhoodEntry[]> {
    return (await this.load()).neighborhoods
  }

  invalidate(): void {
    this.snapshot = null
  }

  private async load(): Promise<Snapshot> {
    if (this.snapshot && this.snapshot.expiresAt > Date.now()) {
      return this.snapshot
    }
    const client = this.db.client
    const [types, amenities, neighborhoods] = await Promise.all([
      client.propertyType.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          isActive: true,
        },
        orderBy: { code: "asc" },
      }),
      client.amenity.findMany({
        select: { id: true, code: true, name: true, category: true },
        orderBy: [{ category: "asc" }, { code: "asc" }],
      }),
      client.neighborhood.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          commune: {
            select: {
              id: true,
              code: true,
              name: true,
              city: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      }),
    ])
    this.snapshot = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      typesByCode: new Map(types.map((type) => [type.code, type])),
      amenitiesByCode: new Map(
        amenities.map((amenity) => [amenity.code, amenity]),
      ),
      neighborhoods: neighborhoods.map((entry) => ({
        id: entry.id,
        code: entry.code,
        name: entry.name,
        communeId: entry.commune.id,
        communeCode: entry.commune.code,
        communeName: entry.commune.name,
        cityId: entry.commune.city.id,
        cityCode: entry.commune.city.code,
        cityName: entry.commune.city.name,
      })),
    }
    return this.snapshot
  }
}
