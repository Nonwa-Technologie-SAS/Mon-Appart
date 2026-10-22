import { HttpStatus, Injectable } from "@nestjs/common"
import type { CursorPage } from "@mon-appart/types"
import { decodeCursor, encodeCursor } from "@mon-appart/validation"

import { AppException } from "../../../common/http/app-exception"
import type { OwnershipType } from "../../../generated/prisma/enums"
import { AuthErrorCode, can, type Actor } from "../../identity"
import { canViewPrivate } from "../domain/property-access"
import { propertyError, PropertyErrorCode } from "../domain/property-errors"
import { CatalogRepository } from "../infrastructure/catalog.repository"
import {
  PropertyRepository,
  type PropertyDetailRow,
  type PropertySearchFilters,
  type PropertySummaryRow,
} from "../infrastructure/property.repository"
import { PropertyAccessService } from "./property-access.service"
import type { PropertySearchInput } from "./property-inputs"

export const DEFAULT_PAGE_SIZE = 20
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PropertyView =
  | { mode: "public"; row: PropertyDetailRow }
  | { mode: "private"; row: PropertyDetailRow; relation: OwnershipType | null }

export interface PropertyListPage extends CursorPage<PropertySummaryRow> {
  mode: "public" | "private"
}

@Injectable()
export class PropertyQueryService {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly catalog: CatalogRepository,
    private readonly access: PropertyAccessService,
  ) {}

  /**
   * Vue privée pour les gestionnaires (propriétaire, mandataire, admin), vue
   * publique pour un bien actif, sinon 404 : un brouillon n'existe pas pour
   * les autres.
   */
  async getOne(actor: Actor | null, publicId: string): Promise<PropertyView> {
    const row = await this.properties.findDetail(publicId)
    if (!row || row.deletedAt) {
      throw propertyError(PropertyErrorCode.PROPERTY_NOT_FOUND)
    }
    const relation = await this.access.relationOf(actor, row.id)
    const override = actor !== null && can(actor, "property:manage")
    if (canViewPrivate(relation, override)) {
      return { mode: "private", row, relation }
    }
    if (row.status !== "ACTIVE") {
      throw propertyError(PropertyErrorCode.PROPERTY_NOT_FOUND)
    }
    return { mode: "public", row }
  }

  async list(
    actor: Actor | null,
    input: PropertySearchInput,
  ): Promise<PropertyListPage> {
    const scope = input.scope ?? "public"
    if (scope !== "public" && !actor) {
      throw new AppException(
        AuthErrorCode.UNAUTHENTICATED,
        HttpStatus.UNAUTHORIZED,
        "Authentification requise",
      )
    }
    if (scope === "all" && !(actor && can(actor, "property:manage"))) {
      throw propertyError(PropertyErrorCode.PROPERTY_ACCESS_DENIED)
    }

    const limit = input.limit ?? DEFAULT_PAGE_SIZE
    const filters: PropertySearchFilters = {
      scope,
      actorId: actor?.userId ?? null,
      limit: limit + 1,
      ...(input.status && scope !== "public" ? { status: input.status } : {}),
      ...(input.minSurface !== undefined
        ? { minSurface: input.minSurface }
        : {}),
      ...(input.maxSurface !== undefined
        ? { maxSurface: input.maxSurface }
        : {}),
      ...(input.bedrooms !== undefined ? { minBedrooms: input.bedrooms } : {}),
      ...(input.bathrooms !== undefined
        ? { minBathrooms: input.bathrooms }
        : {}),
    }
    if (input.propertyType) {
      const type = await this.catalog.propertyType(input.propertyType)
      if (!type) throw propertyError(PropertyErrorCode.INVALID_PROPERTY_TYPE)
      filters.propertyTypeId = type.id
    }
    const neighborhoodIds = await resolveNeighborhoodFilter(this.catalog, input)
    if (neighborhoodIds) filters.neighborhoodIds = neighborhoodIds
    const near = resolveNear(input)
    if (near) filters.near = near
    if (input.cursor) filters.cursorPublicId = parseCursor(input.cursor)

    const rows = await this.properties.search(filters)
    const items = rows.slice(0, limit)
    const last = items[items.length - 1]
    return {
      mode: scope === "public" ? "public" : "private",
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              id: last.publicId,
              createdAt: last.createdAt.toISOString(),
            })
          : null,
    }
  }

  propertyTypes() {
    return this.catalog
      .propertyTypes()
      .then((types) => types.filter((type) => type.isActive))
  }

  amenities() {
    return this.catalog.amenities()
  }
}

/** Filtre commune / quartier traduit en identifiants de quartier. */
export async function resolveNeighborhoodFilter(
  catalog: CatalogRepository,
  input: { commune?: string; neighborhood?: string },
): Promise<number[] | null> {
  if (input.neighborhood) {
    if (!input.commune) {
      throw propertyError(
        PropertyErrorCode.INVALID_LOCATION,
        "le filtre quartier exige la commune",
      )
    }
    const entry = await catalog.neighborhood(input.commune, input.neighborhood)
    if (!entry)
      throw propertyError(
        PropertyErrorCode.INVALID_LOCATION,
        "quartier inconnu",
      )
    return [entry.id]
  }
  if (input.commune) {
    const ids = await catalog.neighborhoodIdsOfCommune(input.commune)
    if (ids.length === 0) {
      throw propertyError(
        PropertyErrorCode.INVALID_LOCATION,
        "commune inconnue",
      )
    }
    return ids
  }
  return null
}

export function resolveNear(input: {
  latitude?: number
  longitude?: number
  radiusKm?: number
}): { latitude: number; longitude: number; radiusMeters: number } | null {
  const { latitude, longitude, radiusKm } = input
  if (
    latitude === undefined &&
    longitude === undefined &&
    radiusKm === undefined
  ) {
    return null
  }
  if (
    latitude === undefined ||
    longitude === undefined ||
    radiusKm === undefined
  ) {
    throw propertyError(
      PropertyErrorCode.INVALID_LOCATION,
      "latitude, longitude et radiusKm vont ensemble",
    )
  }
  return { latitude, longitude, radiusMeters: radiusKm * 1000 }
}

/** Le curseur porte l'identifiant public du dernier élément de la page. */
export function parseCursor(cursor: string): string {
  const payload = decodeCursor(cursor)
  if (!payload || !UUID_PATTERN.test(payload.id)) {
    throw propertyError(PropertyErrorCode.INVALID_CURSOR)
  }
  return payload.id
}
