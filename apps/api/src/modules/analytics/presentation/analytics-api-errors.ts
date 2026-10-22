import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../../identity"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, ANALYTICS_BATCH_INVALID, ANALYTICS_RANGE_INVALID)",
  401: "Non authentifié (UNAUTHENTICATED, TOKEN_EXPIRED, SESSION_REVOKED)",
  403: "Interdit (INSUFFICIENT_PERMISSION)",
  404: "Introuvable ou non gérée par vous (LISTING_NOT_FOUND)",
  422: "Demande refusée (CONSENT_POLICY_MISMATCH)",
  429: "Trop de requêtes (TOO_MANY_REQUESTS)",
}

/** Réponses d'erreur Swagger du module Analytics. */
export function AnalyticsApiErrors(...statuses: number[]) {
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
