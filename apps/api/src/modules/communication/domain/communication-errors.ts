import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

const DEFINITIONS = {
  CONVERSATION_NOT_FOUND: [HttpStatus.NOT_FOUND, "Conversation introuvable"],
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  LISTING_NOT_CONTACTABLE: [
    HttpStatus.CONFLICT,
    "Cette annonce ne peut pas être contactée pour le moment",
  ],
  CANNOT_CONTACT_OWN_LISTING: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Vous gérez ce bien : impossible de contacter votre propre annonce",
  ],
  CONVERSATION_CLOSED: [HttpStatus.CONFLICT, "Cette conversation est fermée"],
  MESSAGE_INVALID: [HttpStatus.UNPROCESSABLE_ENTITY, "Message invalide"],
  MESSAGE_NOT_FOUND: [HttpStatus.NOT_FOUND, "Message introuvable"],
  ATTACHMENT_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Pièce jointe invalide",
  ],
  ATTACHMENT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Pièce jointe introuvable"],
  TOO_MANY_PENDING_ATTACHMENTS: [
    HttpStatus.CONFLICT,
    "Trop de pièces jointes en attente dans cette conversation",
  ],
  CONVERSATION_RATE_LIMITED: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Trop de nouvelles conversations : réessayez plus tard",
  ],
  MESSAGE_RATE_LIMITED: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Trop de messages envoyés : patientez un instant",
  ],
  MESSAGE_REPEATED: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Ce message a déjà été envoyé à de nombreux interlocuteurs",
  ],
  NOTIFICATION_NOT_FOUND: [HttpStatus.NOT_FOUND, "Notification introuvable"],
  PREFERENCE_LOCKED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Cette notification est nécessaire au service et ne peut pas être désactivée",
  ],
  PUSH_DEVICE_NOT_FOUND: [HttpStatus.NOT_FOUND, "Appareil introuvable"],
  APPOINTMENT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Rendez-vous introuvable"],
  APPOINTMENT_ALREADY_ACTIVE: [
    HttpStatus.CONFLICT,
    "Une visite est déjà en cours pour cette annonce",
  ],
  INVALID_APPOINTMENT_TRANSITION: [
    HttpStatus.CONFLICT,
    "Action impossible dans l'état actuel du rendez-vous",
  ],
  APPOINTMENT_TIME_INVALID: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Horaire de visite invalide",
  ],
  INVALID_CURSOR: [HttpStatus.BAD_REQUEST, "Curseur invalide"],
} as const satisfies Record<string, readonly [HttpStatus, string]>

export type CommunicationErrorCode = keyof typeof DEFINITIONS

export function communicationError(
  code: CommunicationErrorCode,
  detail?: string,
  retryAfterSeconds?: number,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
    retryAfterSeconds,
  )
}

export const COMMUNICATION_ERROR_CODES = Object.keys(
  DEFINITIONS,
) as CommunicationErrorCode[]
