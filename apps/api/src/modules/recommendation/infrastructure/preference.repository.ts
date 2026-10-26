import { Injectable } from "@nestjs/common"
import type { ListingType } from "@mon-appart/types"

import { DatabaseService } from "../../../database/database.service"
import type { PricePeriod } from "../../../generated/prisma/enums"

/** Préférences stockées, identifiants internes. */
export interface StoredPreferences {
  listingTypes: ListingType[]
  minBudget: number | null
  maxBudget: number | null
  currency: string
  budgetPeriod: PricePeriod | null
  budgetTolerancePct: number | null
  bedrooms: number | null
  bathrooms: number | null
  minSurface: number | null
  maxSurface: number | null
  latitude: number | null
  longitude: number | null
  radiusM: number | null
  propertyTypeIds: number[]
  amenityIds: number[]
  communeIds: number[]
  neighborhoodIds: number[]
  updatedAt: Date | null
}

const toNumber = (value: { toString(): string } | null): number | null =>
  value === null ? null : Number(value.toString())

@Injectable()
export class PreferenceRepository {
  constructor(private readonly db: DatabaseService) {}

  async find(userId: bigint): Promise<StoredPreferences | null> {
    const row = await this.db.client.userPreference.findUnique({
      where: { userId },
      include: {
        propertyTypes: { select: { propertyTypeId: true } },
        amenities: { select: { amenityId: true } },
        communes: { select: { communeId: true } },
        neighborhoods: { select: { neighborhoodId: true } },
      },
    })
    if (!row) return null
    return {
      listingTypes: row.preferredListingTypes as ListingType[],
      minBudget: toNumber(row.minBudget),
      maxBudget: toNumber(row.maxBudget),
      currency: row.currency,
      budgetPeriod: row.budgetPeriod,
      budgetTolerancePct: row.budgetTolerancePct,
      bedrooms: row.preferredBedrooms,
      bathrooms: row.preferredBathrooms,
      minSurface: toNumber(row.minSurface),
      maxSurface: toNumber(row.maxSurface),
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
      radiusM: row.radiusM,
      propertyTypeIds: row.propertyTypes
        .map((item) => item.propertyTypeId)
        .sort(byNumber),
      amenityIds: row.amenities.map((item) => item.amenityId).sort(byNumber),
      communeIds: row.communes.map((item) => item.communeId).sort(byNumber),
      neighborhoodIds: row.neighborhoods
        .map((item) => item.neighborhoodId)
        .sort(byNumber),
      updatedAt: row.updatedAt,
    }
  }

  /** Remplacement complet, atomique. */
  async replace(
    userId: bigint,
    input: Omit<StoredPreferences, "updatedAt">,
  ): Promise<void> {
    const data = {
      preferredListingTypes: input.listingTypes,
      minBudget: input.minBudget,
      maxBudget: input.maxBudget,
      currency: input.currency,
      budgetPeriod: input.budgetPeriod,
      budgetTolerancePct: input.budgetTolerancePct,
      preferredBedrooms: input.bedrooms,
      preferredBathrooms: input.bathrooms,
      minSurface: input.minSurface,
      maxSurface: input.maxSurface,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusM: input.radiusM,
    }
    await this.db.client.$transaction(async (tx) => {
      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, ...data },
        // projectStatus / lastReactivationAt restent hors du profil de reco.
        update: { ...data, updatedAt: new Date() },
      })
      await Promise.all([
        tx.userPreferredPropertyType.deleteMany({ where: { userId } }),
        tx.userPreferredAmenity.deleteMany({ where: { userId } }),
        tx.userPreferredCommune.deleteMany({ where: { userId } }),
        tx.userPreferredNeighborhood.deleteMany({ where: { userId } }),
      ])
      await Promise.all([
        tx.userPreferredPropertyType.createMany({
          data: input.propertyTypeIds.map((propertyTypeId) => ({
            userId,
            propertyTypeId,
          })),
        }),
        tx.userPreferredAmenity.createMany({
          data: input.amenityIds.map((amenityId) => ({ userId, amenityId })),
        }),
        tx.userPreferredCommune.createMany({
          data: input.communeIds.map((communeId) => ({ userId, communeId })),
        }),
        tx.userPreferredNeighborhood.createMany({
          data: input.neighborhoodIds.map((neighborhoodId) => ({
            userId,
            neighborhoodId,
          })),
        }),
      ])
    })
  }
}

const byNumber = (a: number, b: number) => a - b
