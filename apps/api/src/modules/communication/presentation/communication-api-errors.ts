import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../../identity"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, INVALID_CURSOR, MESSAGE_INVALID, ATTACHMENT_INVALID)",
  401: "Non authentifié (UNAUTHENTICATED, TOKEN_EXPIRED, SESSION_REVOKED)",
  403: "Interdit (INSUFFICIENT_PERMISSION)",
  404: "Introuvable ou non visible (CONVERSATION_NOT_FOUND, LISTING_NOT_FOUND, MESSAGE_NOT_FOUND, ATTACHMENT_NOT_FOUND, NOTIFICATION_NOT_FOUND, PUSH_DEVICE_NOT_FOUND, APPOINTMENT_NOT_FOUND)",
  409: "Conflit d'état (LISTING_NOT_CONTACTABLE, CONVERSATION_CLOSED, APPOINTMENT_ALREADY_ACTIVE, INVALID_APPOINTMENT_TRANSITION)",
  422: "Demande refusée (CANNOT_CONTACT_OWN_LISTING, PREFERENCE_LOCKED, APPOINTMENT_TIME_INVALID)",
  429: "Trop de requêtes (TOO_MANY_REQUESTS, CONVERSATION_RATE_LIMITED, MESSAGE_RATE_LIMITED, MESSAGE_REPEATED, TOO_MANY_PENDING_ATTACHMENTS)",
}

/** Réponses d'erreur Swagger du module Communication. */
export function CommunicationApiErrors(...statuses: number[]) {
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
