import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const PartnerErrorCode = {
  PARTNER_NOT_FOUND: "PARTNER_NOT_FOUND",
  INTEGRATION_NOT_FOUND: "INTEGRATION_NOT_FOUND",
  DUPLICATE_CODE: "DUPLICATE_CODE",
  SECRETS_KEY_REQUIRED: "SECRETS_KEY_REQUIRED",
  INVALID_WEBHOOK_URL: "INVALID_WEBHOOK_URL",
  INTEGRATION_INACTIVE: "INTEGRATION_INACTIVE",
  IMPORT_INVALID: "IMPORT_INVALID",
  SUPPLY_LEAD_NOT_FOUND: "SUPPLY_LEAD_NOT_FOUND",
  SUPPLY_LEAD_INVALID_TRANSITION: "SUPPLY_LEAD_INVALID_TRANSITION",
} as const

export type PartnerErrorCode =
  (typeof PartnerErrorCode)[keyof typeof PartnerErrorCode]

const META: Record<PartnerErrorCode, [number, string]> = {
  PARTNER_NOT_FOUND: [HttpStatus.NOT_FOUND, "Partenaire introuvable"],
  INTEGRATION_NOT_FOUND: [HttpStatus.NOT_FOUND, "Intégration introuvable"],
  DUPLICATE_CODE: [HttpStatus.CONFLICT, "Code partenaire déjà utilisé"],
  SECRETS_KEY_REQUIRED: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Chiffrement des secrets partenaires non configuré (PARTNERS_SECRETS_KEY)",
  ],
  INVALID_WEBHOOK_URL: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "URL webhook HTTPS invalide",
  ],
  INTEGRATION_INACTIVE: [
    HttpStatus.CONFLICT,
    "Intégration inactive ou non éligible",
  ],
  IMPORT_INVALID: [HttpStatus.UNPROCESSABLE_ENTITY, "Import invalide"],
  SUPPLY_LEAD_NOT_FOUND: [HttpStatus.NOT_FOUND, "Prospect supply introuvable"],
  SUPPLY_LEAD_INVALID_TRANSITION: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Transition de pipeline supply invalide",
  ],
}

export function partnerError(
  code: PartnerErrorCode,
  detail?: string,
): AppException {
  const [status, message] = META[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
