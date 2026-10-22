import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const ListingErrorCode = {
  LISTING_NOT_FOUND: "LISTING_NOT_FOUND",
  LISTING_ACCESS_DENIED: "LISTING_ACCESS_DENIED",
  INVALID_LISTING_STATUS_TRANSITION: "INVALID_LISTING_STATUS_TRANSITION",
  LISTING_ALREADY_PUBLISHED: "LISTING_ALREADY_PUBLISHED",
  LISTING_ALREADY_SOLD: "LISTING_ALREADY_SOLD",
  LISTING_ALREADY_LIVE_FOR_TYPE: "LISTING_ALREADY_LIVE_FOR_TYPE",
  LISTING_NOT_EDITABLE: "LISTING_NOT_EDITABLE",
  LISTING_INCOMPLETE: "LISTING_INCOMPLETE",
  PROPERTY_NOT_ACTIVE: "PROPERTY_NOT_ACTIVE",
  INVALID_PRICE: "INVALID_PRICE",
  NO_ACTIVE_PRICE: "NO_ACTIVE_PRICE",
  INVALID_EXPIRY: "INVALID_EXPIRY",
  VERIFICATION_REQUIRED: "VERIFICATION_REQUIRED",
  LISTING_STATUS_CHANGED: "LISTING_STATUS_CHANGED",
  LISTING_QUOTA_EXCEEDED: "LISTING_QUOTA_EXCEEDED",
} as const

export type ListingErrorCode =
  (typeof ListingErrorCode)[keyof typeof ListingErrorCode]

const DEFINITIONS: Record<ListingErrorCode, [HttpStatus, string]> = {
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  LISTING_ACCESS_DENIED: [
    HttpStatus.FORBIDDEN,
    "Action non autorisée sur cette annonce",
  ],
  INVALID_LISTING_STATUS_TRANSITION: [
    HttpStatus.CONFLICT,
    "Changement de statut de l'annonce non autorisé",
  ],
  LISTING_ALREADY_PUBLISHED: [HttpStatus.CONFLICT, "Annonce déjà publiée"],
  LISTING_ALREADY_SOLD: [HttpStatus.CONFLICT, "Annonce déjà conclue"],
  LISTING_ALREADY_LIVE_FOR_TYPE: [
    HttpStatus.CONFLICT,
    "Une annonce de ce type est déjà en cours pour ce bien",
  ],
  LISTING_NOT_EDITABLE: [
    HttpStatus.CONFLICT,
    "Annonce clôturée : elle n'est plus modifiable",
  ],
  LISTING_INCOMPLETE: [HttpStatus.UNPROCESSABLE_ENTITY, "Annonce incomplète"],
  PROPERTY_NOT_ACTIVE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Le bien doit être actif pour publier",
  ],
  INVALID_PRICE: [HttpStatus.UNPROCESSABLE_ENTITY, "Prix invalide"],
  NO_ACTIVE_PRICE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "L'annonce n'a pas de prix courant",
  ],
  INVALID_EXPIRY: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Date d'expiration invalide",
  ],
  VERIFICATION_REQUIRED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Vérification requise avant publication",
  ],
  LISTING_STATUS_CHANGED: [
    HttpStatus.CONFLICT,
    "Le statut de l'annonce a changé entre-temps : rechargez-la",
  ],
  LISTING_QUOTA_EXCEEDED: [
    HttpStatus.CONFLICT,
    "Nombre maximal d'annonces actives atteint pour votre plan",
  ],
}

export function listingError(
  code: ListingErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
