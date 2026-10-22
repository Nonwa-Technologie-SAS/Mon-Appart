import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const PropertyErrorCode = {
  PROPERTY_NOT_FOUND: "PROPERTY_NOT_FOUND",
  PROPERTY_ACCESS_DENIED: "PROPERTY_ACCESS_DENIED",
  PROPERTY_ALREADY_DELETED: "PROPERTY_ALREADY_DELETED",
  PROPERTY_HAS_ACTIVE_LISTINGS: "PROPERTY_HAS_ACTIVE_LISTINGS",
  PROPERTY_INCOMPLETE: "PROPERTY_INCOMPLETE",
  INVALID_PROPERTY_STATUS_TRANSITION: "INVALID_PROPERTY_STATUS_TRANSITION",
  INVALID_PROPERTY_TYPE: "INVALID_PROPERTY_TYPE",
  INVALID_PROPERTY_DATA: "INVALID_PROPERTY_DATA",
  INVALID_LOCATION: "INVALID_LOCATION",
  INVALID_AMENITY: "INVALID_AMENITY",
  INVALID_OWNERSHIP_TYPE: "INVALID_OWNERSHIP_TYPE",
  INVALID_CURSOR: "INVALID_CURSOR",
} as const

export type PropertyErrorCode =
  (typeof PropertyErrorCode)[keyof typeof PropertyErrorCode]

const DEFINITIONS: Record<PropertyErrorCode, [HttpStatus, string]> = {
  PROPERTY_NOT_FOUND: [HttpStatus.NOT_FOUND, "Bien introuvable"],
  PROPERTY_ACCESS_DENIED: [HttpStatus.FORBIDDEN, "Vous ne gérez pas ce bien"],
  PROPERTY_ALREADY_DELETED: [HttpStatus.CONFLICT, "Bien déjà supprimé"],
  PROPERTY_HAS_ACTIVE_LISTINGS: [
    HttpStatus.CONFLICT,
    "Le bien a des annonces en cours : archivez-les d'abord",
  ],
  PROPERTY_INCOMPLETE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Informations du bien incomplètes",
  ],
  INVALID_PROPERTY_STATUS_TRANSITION: [
    HttpStatus.CONFLICT,
    "Changement de statut du bien non autorisé",
  ],
  INVALID_PROPERTY_TYPE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Type de bien inconnu ou inactif",
  ],
  INVALID_PROPERTY_DATA: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Caractéristiques du bien invalides",
  ],
  INVALID_LOCATION: [HttpStatus.UNPROCESSABLE_ENTITY, "Localisation invalide"],
  INVALID_AMENITY: [HttpStatus.UNPROCESSABLE_ENTITY, "Équipement inconnu"],
  INVALID_OWNERSHIP_TYPE: [
    HttpStatus.FORBIDDEN,
    "Type de rattachement au bien non autorisé pour ce compte",
  ],
  INVALID_CURSOR: [HttpStatus.BAD_REQUEST, "Curseur de pagination invalide"],
}

/** `detail` complète le message ; il ne contient que des noms de champs ou codes. */
export function propertyError(
  code: PropertyErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
