import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../../identity"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, ADMIN_QUERY_INVALID, ADMIN_CURSOR_INVALID)",
  401: "Non authentifié (UNAUTHENTICATED, TOKEN_EXPIRED, SESSION_REVOKED)",
  403: "Interdit (INSUFFICIENT_PERMISSION, ADMIN_ROLE_FORBIDDEN, ADMIN_TARGET_PROTECTED, ADMIN_CONTACT_SEARCH_FORBIDDEN, SELF_ADMINISTRATION_FORBIDDEN)",
  404: "Introuvable (USER_NOT_FOUND, LISTING_NOT_FOUND, MODERATION_REASON_NOT_FOUND)",
  409: "Conflit d'état (ACCOUNT_STATUS_CHANGED, INVALID_STATUS_CHANGE, LAST_SUPER_ADMIN, LISTING_STATUS_CHANGED, MODERATION_NOT_APPLICABLE, MODERATION_REASON_EXISTS)",
  422: "Demande refusée (MODERATION_REASON_REQUIRED, MODERATION_REASON_INVALID, MODERATION_JUSTIFICATION_REQUIRED)",
  429: "Trop de requêtes (TOO_MANY_REQUESTS)",
}

/** Réponses d'erreur Swagger du back-office. */
export function AdminApiErrors(...statuses: number[]) {
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
