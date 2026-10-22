import { Injectable, Logger } from "@nestjs/common"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { DatabaseService } from "../../../database/database.service"
import type { ResolvedSearch } from "../domain/search-engine"

/**
 * Historique des recherches validées (table `searches`). Une ligne par
 * soumission, jamais par frappe ni par page suivante. Les colonnes typées
 * portent les filtres simples ; `filters` garde un instantané complet.
 */
@Injectable()
export class SearchHistoryService {
  private readonly logger = new Logger(SearchHistoryService.name)

  constructor(private readonly db: DatabaseService) {}

  /** N'échoue jamais : l'historique ne doit pas casser une recherche. */
  async record(
    request: ResolvedSearch,
    userId: bigint | null,
    resultCount: number,
  ): Promise<void> {
    const { query } = request
    const single = <T>(values: readonly T[]): T | null =>
      values.length === 1 ? (values[0] ?? null) : null
    try {
      await this.db.client.search.create({
        data: {
          userId,
          query: query.text?.normalized.slice(0, 255) ?? null,
          listingType: single(query.listingTypes),
          propertyTypeId: single(request.propertyTypeIds),
          minPrice: query.price.min,
          maxPrice: query.price.max,
          minSurface: query.surface.min,
          maxSurface: query.surface.max,
          bedrooms: query.bedrooms.min,
          bathrooms: query.bathrooms.min,
          neighborhoodId:
            query.neighborhoods.length > 0
              ? single(request.neighborhoodIds ?? [])
              : null,
          latitude: query.geo?.latitude ?? null,
          longitude: query.geo?.longitude ?? null,
          radiusM: query.geo ? Math.round(query.geo.radiusKm * 1000) : null,
          filters: {
            v: 1,
            listingTypes: query.listingTypes,
            propertyTypes: query.propertyTypes,
            cities: query.cities,
            communes: query.communes,
            neighborhoods: query.neighborhoods,
            amenities: query.amenities,
            amenitiesMode: query.amenitiesMode,
            landSurface: {
              min: query.landSurface.min,
              max: query.landSurface.max,
            },
            maxBedrooms: query.bedrooms.max,
            sort: query.sort,
            resultCount,
          },
        },
      })
    } catch (error) {
      this.logger.warn(
        `Historique de recherche non enregistré : ${safeErrorMessage(error)}`,
      )
    }
  }
}
