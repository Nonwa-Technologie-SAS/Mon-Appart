import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../../identity"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, INVALID_CURSOR)",
  401: "Non authentifié (UNAUTHENTICATED, TOKEN_EXPIRED, SESSION_REVOKED)",
  403: "Interdit (INSUFFICIENT_PERMISSION, PROPERTY_ACCESS_DENIED, LISTING_ACCESS_DENIED, INVALID_OWNERSHIP_TYPE)",
  404: "Introuvable ou non visible (PROPERTY_NOT_FOUND, LISTING_NOT_FOUND)",
  409: "Conflit d'état (PROPERTY_ALREADY_DELETED, PROPERTY_HAS_ACTIVE_LISTINGS, INVALID_*_STATUS_TRANSITION, LISTING_ALREADY_PUBLISHED, LISTING_ALREADY_SOLD, LISTING_ALREADY_LIVE_FOR_TYPE)",
  422: "Refus métier (INVALID_PROPERTY_TYPE, INVALID_PROPERTY_DATA, INVALID_LOCATION, INVALID_AMENITY, PROPERTY_INCOMPLETE, PROPERTY_NOT_ACTIVE, INVALID_PRICE, NO_ACTIVE_PRICE, LISTING_INCOMPLETE)",
  503: "Base de données indisponible (DATABASE_UNAVAILABLE)",
}

/** Réponses d'erreur Swagger des modules Property et Listing. */
export function CatalogApiErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status],
        type: ErrorResponseDto,
      }),
    ),
  )
}
