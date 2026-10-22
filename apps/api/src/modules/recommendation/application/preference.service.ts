import { Injectable } from "@nestjs/common"
import type {
  BudgetPeriod,
  ListingType,
  RecommendationPreferences,
} from "@mon-appart/types"

import { CatalogRepository, type NeighborhoodEntry } from "../../property"
import { deducePeriod, type Budget } from "../domain/budget"
import {
  recommendationError,
  RecommendationErrorCode,
} from "../domain/recommendation-errors"
import type { DeclaredPreferences } from "../domain/recommendation-input"
import {
  PreferenceRepository,
  type StoredPreferences,
} from "../infrastructure/preference.repository"
import { RecommendationCache } from "../infrastructure/recommendation-cache"
import { RecommendationConfig } from "../recommendation.config"

/** Corps de `PUT /recommendations/preferences` : remplacement complet. */
export interface PreferenceInput {
  listingTypes?: ListingType[]
  minBudget?: number | null
  maxBudget?: number | null
  currency?: string
  budgetPeriod?: BudgetPeriod | null
  budgetTolerancePct?: number | null
  propertyTypes?: string[]
  communes?: string[]
  neighborhoods?: string[]
  amenities?: string[]
  bedrooms?: number | null
  bathrooms?: number | null
  minSurface?: number | null
  maxSurface?: number | null
  latitude?: number | null
  longitude?: number | null
  radiusKm?: number | null
}

const DEFAULT_CURRENCY = "XOF"
const DEFAULT_RADIUS_KM = 5

const invalid = (detail: string) =>
  recommendationError(RecommendationErrorCode.INVALID_PREFERENCES, detail)

/**
 * Préférences déclarées. Le budget est stocké tel que saisi ; sa périodicité
 * doit être explicite ou se déduire sans ambiguïté des types d'offre.
 */
@Injectable()
export class PreferenceService {
  constructor(
    private readonly repository: PreferenceRepository,
    private readonly catalog: CatalogRepository,
    private readonly cache: RecommendationCache,
    private readonly config: RecommendationConfig,
  ) {}

  async get(userId: bigint): Promise<RecommendationPreferences> {
    return this.present(await this.repository.find(userId))
  }

  async replace(
    userId: bigint,
    userPublicId: string,
    input: PreferenceInput,
  ): Promise<RecommendationPreferences> {
    const stored = await this.validate(input)
    await this.repository.replace(userId, stored)
    await this.cache.bumpUser(userPublicId)
    return this.get(userId)
  }

  /** Préférences au format du moteur ; `null` si l'utilisateur n'en a pas. */
  async declared(userId: bigint): Promise<DeclaredPreferences | null> {
    const stored = await this.repository.find(userId)
    if (!stored) return null
    const [types, amenities, neighborhoods] = await Promise.all([
      this.catalog.propertyTypes(),
      this.catalog.amenities(),
      this.catalog.neighborhoods(),
    ])
    const typeById = new Map(types.map((type) => [type.id, type]))
    const amenityById = new Map(
      amenities.map((amenity) => [amenity.id, amenity]),
    )
    const neighborhoodById = new Map(
      neighborhoods.map((entry) => [entry.id, entry]),
    )
    const preferredNeighborhoods = stored.neighborhoodIds.flatMap((id) => {
      const entry = neighborhoodById.get(id)
      return entry ? [entry] : []
    })
    const communeCity = new Map(
      neighborhoods.map((entry) => [entry.communeId, entry.cityId]),
    )

    let budget: Budget | null = null
    if (stored.minBudget !== null || stored.maxBudget !== null) {
      const period = stored.budgetPeriod ?? deducePeriod(stored.listingTypes)
      // Garanti à l'enregistrement ; une donnée antérieure ambiguë n'est pas devinée.
      if (period) {
        budget = {
          min: stored.minBudget,
          max: stored.maxBudget,
          currency: stored.currency,
          period,
          tolerancePct: stored.budgetTolerancePct ?? 0,
        }
      }
    }

    return {
      listingTypes: stored.listingTypes,
      budget,
      propertyTypeIds: stored.propertyTypeIds,
      propertyCategories: [
        ...new Set(
          stored.propertyTypeIds.flatMap((id) => {
            const type = typeById.get(id)
            return type ? [type.category] : []
          }),
        ),
      ],
      neighborhoodIds: stored.neighborhoodIds,
      communeIds: stored.communeIds,
      nearbyCommuneIds: unique(
        preferredNeighborhoods.map((entry) => entry.communeId),
      ),
      cityIds: unique([
        ...preferredNeighborhoods.map((entry) => entry.cityId),
        ...stored.communeIds.flatMap((id) => {
          const city = communeCity.get(id)
          return city === undefined ? [] : [city]
        }),
      ]),
      amenityCodes: stored.amenityIds.flatMap((id) => {
        const amenity = amenityById.get(id)
        return amenity ? [amenity.code] : []
      }),
      bedrooms: stored.bedrooms,
      bathrooms: stored.bathrooms,
      surface: { min: stored.minSurface, max: stored.maxSurface },
      point:
        stored.latitude !== null && stored.longitude !== null
          ? {
              latitude: stored.latitude,
              longitude: stored.longitude,
              radiusMeters: stored.radiusM ?? DEFAULT_RADIUS_KM * 1000,
            }
          : null,
    }
  }

  private async validate(
    input: PreferenceInput,
  ): Promise<Omit<StoredPreferences, "updatedAt">> {
    const listingTypes = unique(input.listingTypes ?? [])
    const minBudget = input.minBudget ?? null
    const maxBudget = input.maxBudget ?? null
    if (minBudget !== null && maxBudget !== null && minBudget > maxBudget) {
      throw invalid("minBudget > maxBudget")
    }
    const hasBudget = minBudget !== null || maxBudget !== null
    const budgetPeriod = input.budgetPeriod ?? null
    if (
      hasBudget &&
      budgetPeriod === null &&
      deducePeriod(listingTypes) === null
    ) {
      throw recommendationError(
        RecommendationErrorCode.BUDGET_PERIOD_REQUIRED,
        "budgetPeriod",
      )
    }
    const tolerance = input.budgetTolerancePct ?? null
    if (tolerance !== null && maxBudget === null) {
      throw invalid("budgetTolerancePct exige maxBudget")
    }

    const minSurface = input.minSurface ?? null
    const maxSurface = input.maxSurface ?? null
    if (minSurface !== null && maxSurface !== null && minSurface > maxSurface) {
      throw invalid("minSurface > maxSurface")
    }

    const latitude = input.latitude ?? null
    const longitude = input.longitude ?? null
    const radiusKm = input.radiusKm ?? null
    if ((latitude === null) !== (longitude === null)) {
      throw invalid("latitude et longitude")
    }
    if (radiusKm !== null && latitude === null) {
      throw invalid("radiusKm exige latitude et longitude")
    }
    if (radiusKm !== null && radiusKm > this.config.maxRadiusKm) {
      throw invalid(`radiusKm : ${this.config.maxRadiusKm} km maximum`)
    }

    const [types, amenities, neighborhoods] = await Promise.all([
      this.catalog.propertyTypes(),
      this.catalog.amenities(),
      this.catalog.neighborhoods(),
    ])
    const resolve = <T>(
      codes: string[] | undefined,
      lookup: (code: string) => T[],
      name: string,
    ): T[] => {
      const result: T[] = []
      for (const code of unique(codes ?? [])) {
        const matches = lookup(code)
        if (matches.length === 0) throw invalid(`${name} inconnu`)
        result.push(...matches)
      }
      return unique(result)
    }
    const propertyTypeIds = resolve(
      input.propertyTypes,
      (code) =>
        types
          .filter((type) => type.code === code && type.isActive)
          .map((type) => type.id),
      "propertyType",
    )
    const amenityIds = resolve(
      input.amenities,
      (code) =>
        amenities
          .filter((amenity) => amenity.code === code)
          .map((amenity) => amenity.id),
      "amenity",
    )
    const communeIds = resolve(
      input.communes,
      (code) =>
        unique(
          neighborhoods
            .filter((entry) => entry.communeCode === code)
            .map((entry) => entry.communeId),
        ),
      "commune",
    )
    const neighborhoodIds = resolve(
      input.neighborhoods,
      (code) =>
        neighborhoods
          .filter((entry) => entry.code === code)
          .map((entry) => entry.id),
      "neighborhood",
    )

    return {
      listingTypes,
      minBudget,
      maxBudget,
      currency: input.currency ?? DEFAULT_CURRENCY,
      budgetPeriod,
      budgetTolerancePct: tolerance,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      minSurface,
      maxSurface,
      latitude,
      longitude,
      radiusM:
        latitude === null
          ? null
          : Math.round((radiusKm ?? DEFAULT_RADIUS_KM) * 1000),
      propertyTypeIds: propertyTypeIds.sort((a, b) => a - b),
      amenityIds: amenityIds.sort((a, b) => a - b),
      communeIds: communeIds.sort((a, b) => a - b),
      neighborhoodIds: neighborhoodIds.sort((a, b) => a - b),
    }
  }

  private async present(
    stored: StoredPreferences | null,
  ): Promise<RecommendationPreferences> {
    const [types, amenities, neighborhoods] = await Promise.all([
      this.catalog.propertyTypes(),
      this.catalog.amenities(),
      this.catalog.neighborhoods(),
    ])
    const codesOf = <T extends { id: number }>(
      ids: number[],
      entries: T[],
      code: (entry: T) => string,
    ) => {
      const byId = new Map(entries.map((entry) => [entry.id, entry]))
      return unique(
        ids.flatMap((id) => {
          const entry = byId.get(id)
          return entry ? [code(entry)] : []
        }),
      )
    }
    const communes = new Map<number, NeighborhoodEntry>()
    for (const entry of neighborhoods) communes.set(entry.communeId, entry)
    return {
      listingTypes: stored?.listingTypes ?? [],
      budget: {
        min: stored?.minBudget ?? null,
        max: stored?.maxBudget ?? null,
        currency: stored?.currency ?? DEFAULT_CURRENCY,
        period: stored?.budgetPeriod ?? null,
        tolerancePct: stored?.budgetTolerancePct ?? 0,
      },
      propertyTypes: codesOf(
        stored?.propertyTypeIds ?? [],
        types,
        (type) => type.code,
      ),
      communes: unique(
        (stored?.communeIds ?? []).flatMap((id) => {
          const entry = communes.get(id)
          return entry ? [entry.communeCode] : []
        }),
      ),
      neighborhoods: codesOf(
        stored?.neighborhoodIds ?? [],
        neighborhoods,
        (entry) => entry.code,
      ),
      amenities: codesOf(
        stored?.amenityIds ?? [],
        amenities,
        (amenity) => amenity.code,
      ),
      bedrooms: stored?.bedrooms ?? null,
      bathrooms: stored?.bathrooms ?? null,
      surface: {
        min: stored?.minSurface ?? null,
        max: stored?.maxSurface ?? null,
      },
      point:
        stored && stored.latitude !== null && stored.longitude !== null
          ? {
              latitude: stored.latitude,
              longitude: stored.longitude,
              radiusKm: (stored.radiusM ?? DEFAULT_RADIUS_KM * 1000) / 1000,
            }
          : null,
      updatedAt: stored?.updatedAt?.toISOString() ?? null,
    }
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}
