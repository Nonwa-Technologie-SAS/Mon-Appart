import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

const DEFINITIONS = {
  VERIFICATION_NOT_FOUND: [HttpStatus.NOT_FOUND, "Vérification introuvable"],
  VERIFICATION_TYPE_NOT_SUPPORTED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Ce type de vérification ne peut pas être demandé ici",
  ],
  VERIFICATION_SCOPE_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Bien ou annonce manquant ou incohérent pour ce type de vérification",
  ],
  VERIFICATION_ALREADY_OPEN: [
    HttpStatus.CONFLICT,
    "Un dossier de ce type est déjà en cours",
  ],
  VERIFICATION_ALREADY_VERIFIED: [
    HttpStatus.CONFLICT,
    "Une vérification de ce type est déjà valide",
  ],
  INVALID_VERIFICATION_TRANSITION: [
    HttpStatus.CONFLICT,
    "Action impossible dans l'état actuel du dossier",
  ],
  VERIFICATION_NOT_EDITABLE: [
    HttpStatus.CONFLICT,
    "Le dossier n'accepte plus de pièce dans son état actuel",
  ],
  CLAIMED_RELATION_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Rattachement revendiqué invalide pour ce type de vérification",
  ],
  IDENTITY_VERIFICATION_REQUIRED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Une vérification d'identité valide est requise au préalable",
  ],
  ATTESTATION_REQUIRED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "La déclaration sur l'honneur doit être acceptée",
  ],
  DOCUMENT_TYPE_NOT_ACCEPTED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Type de pièce non accepté pour ce dossier",
  ],
  TOO_MANY_DOCUMENTS: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Nombre maximal de pièces atteint",
  ],
  DOCUMENTS_INCOMPLETE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Pièces obligatoires manquantes",
  ],
  DOCUMENTS_NOT_READY: [
    HttpStatus.CONFLICT,
    "Des pièces sont encore en cours d'envoi ou de contrôle",
  ],
  VERIFICATION_DOCUMENT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Pièce introuvable"],
  PROPERTY_NOT_FOUND: [HttpStatus.NOT_FOUND, "Bien introuvable"],
  PROPERTY_ACCESS_DENIED: [HttpStatus.FORBIDDEN, "Vous ne gérez pas ce bien"],
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  USER_NOT_FOUND: [HttpStatus.NOT_FOUND, "Utilisateur introuvable"],
  SELF_REVIEW_FORBIDDEN: [
    HttpStatus.FORBIDDEN,
    "Impossible d'instruire ou de décider de son propre dossier",
  ],
  CONFLICT_OF_INTEREST: [
    HttpStatus.FORBIDDEN,
    "Conflit d'intérêts : vous êtes lié à ce bien ou à ce signalement",
  ],
  DECISION_PERMISSION_REQUIRED: [
    HttpStatus.FORBIDDEN,
    "Permission de décision manquante",
  ],
  REASON_CODE_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Motif invalide pour cette action",
  ],
  ASSIGNEE_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Ce compte ne peut pas instruire de dossier",
  ],
  REPORT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Signalement introuvable"],
  REPORT_ALREADY_OPEN: [
    HttpStatus.CONFLICT,
    "Vous avez déjà un signalement en cours pour cette cible",
  ],
  REPORT_SELF_FORBIDDEN: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Vous ne pouvez pas vous signaler vous-même ni vos propres annonces",
  ],
  REPORT_LIMIT_REACHED: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Limite quotidienne de signalements atteinte",
  ],
  INVALID_REPORT_TRANSITION: [HttpStatus.CONFLICT, "Signalement déjà traité"],
  SIGNAL_NOT_FOUND: [HttpStatus.NOT_FOUND, "Alerte introuvable"],
  SIGNAL_ALREADY_REVIEWED: [HttpStatus.CONFLICT, "Alerte déjà examinée"],
  INVALID_CURSOR: [HttpStatus.BAD_REQUEST, "Curseur invalide"],
} as const satisfies Record<string, readonly [HttpStatus, string]>

export type TrustErrorCode = keyof typeof DEFINITIONS

export function trustError(
  code: TrustErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}

export const TRUST_ERROR_CODES = Object.keys(DEFINITIONS) as TrustErrorCode[]
