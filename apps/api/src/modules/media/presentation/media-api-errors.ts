import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../../identity"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, INVALID_MEDIA_REQUEST)",
  401: "Non authentifié (UNAUTHENTICATED, TOKEN_EXPIRED, SESSION_REVOKED)",
  403: "Interdit (INSUFFICIENT_PERMISSION, PROPERTY_ACCESS_DENIED, INVALID_UPLOAD_TOKEN)",
  404: "Introuvable ou non visible (PROPERTY_NOT_FOUND, MEDIA_NOT_FOUND, UPLOAD_SESSION_NOT_FOUND)",
  409: "Conflit d'état (PROPERTY_NOT_EDITABLE, MEDIA_LIMIT_REACHED, UPLOAD_NOT_RECEIVED, MEDIA_NOT_READY)",
  410: "Session d'envoi expirée (UPLOAD_SESSION_EXPIRED)",
  412: "Lien d'envoi déjà utilisé (UPLOAD_ALREADY_RECEIVED)",
  413: "Fichier trop volumineux (FILE_TOO_LARGE)",
  415: "Type de fichier refusé (UNSUPPORTED_MEDIA_TYPE)",
  422: "Fichier ou demande refusés (UPLOAD_SIZE_MISMATCH, UPLOAD_CONTENT_MISMATCH, INVALID_MEDIA_ORDER, MEDIA_NOT_PRIMARY_ELIGIBLE)",
  429: "Trop de requêtes ou d'envois en cours (TOO_MANY_REQUESTS, TOO_MANY_PENDING_UPLOADS)",
  503: "Stockage ou base indisponible (STORAGE_UNAVAILABLE, DATABASE_UNAVAILABLE)",
}

/** Réponses d'erreur Swagger du module Media. */
export function MediaApiErrors(...statuses: number[]) {
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
