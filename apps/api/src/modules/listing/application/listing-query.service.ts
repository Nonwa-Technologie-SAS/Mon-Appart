import { HttpStatus, Injectable } from "@nestjs/common"
import type { CursorPage } from "@mon-appart/types"
import { encodeCursor } from "@mon-appart/validation"

import { AppException } from "../../../common/http/app-exception"
import type { OwnershipType } from "../../../generated/prisma/enums"
import { AuthErrorCode, can, type Actor } from "../../identity"
import {
  CatalogRepository,
  DEFAULT_PAGE_SIZE,
  MANAGING_RELATIONS,
  parseCursor,
  PropertyAccessService,
  propertyError,
  PropertyErrorCode,
  resolveNear,
  resolveNeighborhoodFilter,
} from "../../property"
import { listingError, ListingErrorCode } from "../domain/listing-errors"
import {
  ListingRepository,
  type ListingDetailRow,
  type ListingSearchFilters,
  type ListingSummaryRow,
} from "../infrastructure/listing.repository"
import type { ListingSearchInput } from "./listing-inputs"

export type ListingView =
  | { mode: "public"; row: ListingDetailRow }
  | { mode: "private"; row: ListingDetailRow; relation: OwnershipType | null }

export interface ListingListPage extends CursorPage<ListingSummaryRow> {
  mode: "public" | "private"
}

/** Lecture complète réservée : gestionnaires, administration, modération. */
function hasStaffRead(actor: Actor | null): boolean {
  return (
    actor !== null &&
    (can(actor, "listing:manage") ||
      can(actor, "listing:moderate") ||
      can(actor, "listing:suspend"))
  )
}

@Injectable()
export class ListingQueryService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly catalog: CatalogRepository,
    private readonly propertyAccess: PropertyAccessService,
  ) {}

  async getOne(actor: Actor | null, publicId: string): Promise<ListingView> {
    const row = await this.listings.findDetail(publicId)
    if (!row || row.deletedAt)
      throw listingError(ListingErrorCode.LISTING_NOT_FOUND)
    const relation = await this.propertyAccess.relationOf(actor, row.propertyId)
    const manages = relation !== null && MANAGING_RELATIONS.includes(relation)
    if (manages || hasStaffRead(actor)) {
      return { mode: "private", row, relation }
    }
    const visible =
      row.status === "PUBLISHED" &&
      row.property.status === "ACTIVE" &&
      row.property.deletedAt === null
    if (!visible) throw listingError(ListingErrorCode.LISTING_NOT_FOUND)
    return { mode: "public", row }
  }

  /** Historique des prix et des statuts : vue privée uniquement. */
  async history(actor: Actor, publicId: string) {
    const view = await this.getOne(actor, publicId)
    if (view.mode !== "private") {
      throw listingError(ListingErrorCode.LISTING_ACCESS_DENIED)
    }
    const [prices, statuses] = await Promise.all([
      this.listings.priceHistory(view.row.id),
      this.listings.statusHistory(view.row.id),
    ])
    return { prices, statuses }
  }

  async list(
    actor: Actor | null,
    input: ListingSearchInput,
  ): Promise<ListingListPage> {
    const scope = input.scope ?? "public"
    if (scope !== "public" && !actor) {
      throw new AppException(
        AuthErrorCode.UNAUTHENTICATED,
        HttpStatus.UNAUTHORIZED,
        "Authentification requise",
      )
    }
    if (scope === "all" && !hasStaffRead(actor)) {
      throw listingError(ListingErrorCode.LISTING_ACCESS_DENIED)
    }

    const limit = input.limit ?? DEFAULT_PAGE_SIZE
    const filters: ListingSearchFilters = {
      scope,
      actorId: actor?.userId ?? null,
      limit: limit + 1,
      ...(input.status && scope !== "public" ? { status: input.status } : {}),
      ...(input.listingType ? { listingType: input.listingType } : {}),
      ...(input.minPrice !== undefined ? { minPrice: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
      ...(input.period ? { period: input.period } : {}),
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

    const rows = await this.listings.search(filters)
    const items = rows.slice(0, limit)
    const last = items[items.length - 1]
    const sortKey = (row: ListingSummaryRow) =>
      (scope === "public"
        ? (row.publishedAt ?? row.createdAt)
        : row.createdAt
      ).toISOString()
    return {
      mode: scope === "public" ? "public" : "private",
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ id: last.publicId, createdAt: sortKey(last) })
          : null,
    }
  }
}
