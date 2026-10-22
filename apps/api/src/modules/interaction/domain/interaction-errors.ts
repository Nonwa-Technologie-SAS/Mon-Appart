import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const InteractionErrorCode = {
  LISTING_NOT_FOUND: "LISTING_NOT_FOUND",
  INVALID_VIEW: "INVALID_VIEW",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const

export type InteractionErrorCode =
  (typeof InteractionErrorCode)[keyof typeof InteractionErrorCode]

const DEFINITIONS: Record<
  InteractionErrorCode,
  [HttpStatus, string]
> = {
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  INVALID_VIEW: [HttpStatus.BAD_REQUEST, "Consultation invalide"],
  VALIDATION_FAILED: [HttpStatus.BAD_REQUEST, "Paramètres invalides"],
}

export function interactionError(
  code: InteractionErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
