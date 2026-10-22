import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

const DEFINITIONS = {
  ADMIN_ROLE_FORBIDDEN: [
    HttpStatus.FORBIDDEN,
    "Vous ne pouvez pas attribuer ou retirer ce rôle",
  ],
  ADMIN_TARGET_PROTECTED: [
    HttpStatus.FORBIDDEN,
    "Ce compte ne peut être administré qu'avec des droits supérieurs",
  ],
  ADMIN_CONTACT_SEARCH_FORBIDDEN: [
    HttpStatus.FORBIDDEN,
    "Recherche par e-mail ou téléphone réservée aux agents habilités",
  ],
  ADMIN_QUERY_INVALID: [HttpStatus.BAD_REQUEST, "Recherche invalide"],
  ADMIN_CURSOR_INVALID: [HttpStatus.BAD_REQUEST, "Curseur invalide"],
  USER_NOT_FOUND: [HttpStatus.NOT_FOUND, "Utilisateur introuvable"],
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  MODERATION_NOT_APPLICABLE: [
    HttpStatus.CONFLICT,
    "Cette décision ne s'applique pas au statut actuel de l'annonce",
  ],
  MODERATION_REASON_REQUIRED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Motif obligatoire pour cette décision",
  ],
  MODERATION_REASON_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Motif inconnu, inactif ou inadapté à cette décision",
  ],
  MODERATION_JUSTIFICATION_REQUIRED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Justification interne obligatoire pour cette décision",
  ],
  MODERATION_REASON_NOT_FOUND: [
    HttpStatus.NOT_FOUND,
    "Motif de modération introuvable",
  ],
  MODERATION_REASON_EXISTS: [
    HttpStatus.CONFLICT,
    "Un motif existe déjà avec ce code",
  ],
} as const satisfies Record<string, readonly [HttpStatus, string]>

export type AdminErrorCode = keyof typeof DEFINITIONS

export function adminError(
  code: AdminErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
