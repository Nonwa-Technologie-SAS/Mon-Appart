import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

const DEFINITIONS = {
  ANALYTICS_BATCH_INVALID: [
    HttpStatus.BAD_REQUEST,
    "Lot d'événements analytiques invalide",
  ],
  ANALYTICS_DISABLED: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Collecte analytique désactivée",
  ],
  ANALYTICS_RANGE_INVALID: [HttpStatus.BAD_REQUEST, "Période invalide"],
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  CONSENT_POLICY_MISMATCH: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Version de politique de confidentialité obsolète",
  ],
} as const satisfies Record<string, readonly [HttpStatus, string]>

export type AnalyticsErrorCode = keyof typeof DEFINITIONS

export function analyticsError(
  code: AnalyticsErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
