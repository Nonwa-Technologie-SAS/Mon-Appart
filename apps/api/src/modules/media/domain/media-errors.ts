import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const MediaErrorCode = {
  PROPERTY_NOT_FOUND: "PROPERTY_NOT_FOUND",
  PROPERTY_ACCESS_DENIED: "PROPERTY_ACCESS_DENIED",
  PROPERTY_NOT_EDITABLE: "PROPERTY_NOT_EDITABLE",
  MEDIA_NOT_FOUND: "MEDIA_NOT_FOUND",
  UPLOAD_SESSION_NOT_FOUND: "UPLOAD_SESSION_NOT_FOUND",
  UPLOAD_SESSION_EXPIRED: "UPLOAD_SESSION_EXPIRED",
  UPLOAD_NOT_RECEIVED: "UPLOAD_NOT_RECEIVED",
  UPLOAD_SIZE_MISMATCH: "UPLOAD_SIZE_MISMATCH",
  UPLOAD_CONTENT_MISMATCH: "UPLOAD_CONTENT_MISMATCH",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  MEDIA_LIMIT_REACHED: "MEDIA_LIMIT_REACHED",
  TOO_MANY_PENDING_UPLOADS: "TOO_MANY_PENDING_UPLOADS",
  MEDIA_NOT_READY: "MEDIA_NOT_READY",
  MEDIA_NOT_PRIMARY_ELIGIBLE: "MEDIA_NOT_PRIMARY_ELIGIBLE",
  INVALID_MEDIA_ORDER: "INVALID_MEDIA_ORDER",
  INVALID_MEDIA_REQUEST: "INVALID_MEDIA_REQUEST",
  INVALID_UPLOAD_TOKEN: "INVALID_UPLOAD_TOKEN",
  UPLOAD_ALREADY_RECEIVED: "UPLOAD_ALREADY_RECEIVED",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
} as const

export type MediaErrorCode =
  (typeof MediaErrorCode)[keyof typeof MediaErrorCode]

const DEFINITIONS: Record<MediaErrorCode, [HttpStatus, string]> = {
  PROPERTY_NOT_FOUND: [HttpStatus.NOT_FOUND, "Bien introuvable"],
  PROPERTY_ACCESS_DENIED: [HttpStatus.FORBIDDEN, "Vous ne gérez pas ce bien"],
  PROPERTY_NOT_EDITABLE: [
    HttpStatus.CONFLICT,
    "Le bien est archivé ou supprimé : ses médias ne sont plus modifiables",
  ],
  MEDIA_NOT_FOUND: [HttpStatus.NOT_FOUND, "Média introuvable"],
  UPLOAD_SESSION_NOT_FOUND: [
    HttpStatus.NOT_FOUND,
    "Session d'envoi introuvable",
  ],
  UPLOAD_SESSION_EXPIRED: [
    HttpStatus.GONE,
    "Session d'envoi expirée : recommencez l'envoi",
  ],
  UPLOAD_NOT_RECEIVED: [
    HttpStatus.CONFLICT,
    "Fichier non reçu par le stockage : terminez l'envoi puis réessayez",
  ],
  UPLOAD_SIZE_MISMATCH: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "La taille du fichier reçu ne correspond pas à la taille annoncée",
  ],
  UPLOAD_CONTENT_MISMATCH: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Le contenu du fichier ne correspond pas au type annoncé",
  ],
  UNSUPPORTED_MEDIA_TYPE: [
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    "Type de fichier non accepté",
  ],
  FILE_TOO_LARGE: [HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux"],
  MEDIA_LIMIT_REACHED: [
    HttpStatus.CONFLICT,
    "Nombre maximal de médias atteint pour ce bien",
  ],
  TOO_MANY_PENDING_UPLOADS: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Trop d'envois en cours : terminez-les avant d'en ouvrir d'autres",
  ],
  MEDIA_NOT_READY: [HttpStatus.CONFLICT, "Média pas encore disponible"],
  MEDIA_NOT_PRIMARY_ELIGIBLE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Seule une photo publique prête peut être l'image principale",
  ],
  INVALID_MEDIA_ORDER: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "L'ordre doit lister exactement les médias du bien, sans doublon",
  ],
  INVALID_MEDIA_REQUEST: [HttpStatus.BAD_REQUEST, "Requête média invalide"],
  INVALID_UPLOAD_TOKEN: [
    HttpStatus.FORBIDDEN,
    "Lien d'envoi invalide ou expiré",
  ],
  UPLOAD_ALREADY_RECEIVED: [
    HttpStatus.PRECONDITION_FAILED,
    "Ce lien d'envoi a déjà été utilisé",
  ],
  STORAGE_UNAVAILABLE: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Stockage des fichiers momentanément indisponible",
  ],
}

/** `detail` ne contient que des noms de champs, des codes ou des bornes. */
export function mediaError(
  code: MediaErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}

/**
 * Échec de traitement. `permanent` : le fichier est refusé (REJECTED), sinon
 * le travail est retenté. Le code est stocké tel quel dans `processing_error`.
 */
export class MediaProcessingError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean,
  ) {
    super(code)
    this.name = "MediaProcessingError"
  }
}

export const rejectMedia = (code: string) =>
  new MediaProcessingError(code, true)
