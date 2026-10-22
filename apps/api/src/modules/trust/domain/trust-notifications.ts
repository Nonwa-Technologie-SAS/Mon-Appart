import type { VerificationType } from "../../../generated/prisma/enums"
import { reasonMessage } from "./reason-codes"

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  PHONE: "Téléphone",
  EMAIL: "E-mail",
  IDENTITY: "Identité",
  PROPERTY_OWNERSHIP: "Propriété du bien",
  OWNER_AUTHORIZATION: "Mandat du propriétaire",
  PROPERTY_DOCUMENT: "Documents du bien",
  AGENCY: "Agence",
  LISTING_CONSISTENCY: "Contrôle de l'annonce",
  ADDRESS: "Adresse",
  DOCUMENT: "Document",
}

export interface NotificationText {
  title: string
  body: string
}

const date = (value: Date) =>
  value.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Abidjan",
  })

/** Motif public et message du relecteur ; jamais la note interne. */
function withReason(code: string | null, message: string | null): string {
  return [reasonMessage(code), message?.trim()].filter(Boolean).join(" ")
}

export const verificationNotice = {
  submitted: (type: VerificationType): NotificationText => ({
    title: "Dossier de vérification reçu",
    body: `Votre dossier « ${VERIFICATION_TYPE_LABELS[type]} » a été transmis pour examen.`,
  }),
  informationRequested: (
    type: VerificationType,
    code: string,
    message: string | null,
  ): NotificationText => ({
    title: "Complément demandé",
    body: `Dossier « ${VERIFICATION_TYPE_LABELS[type]} » : ${withReason(code, message)}`,
  }),
  approved: (
    type: VerificationType,
    expiresAt: Date | null,
  ): NotificationText => ({
    title: "Vérification approuvée",
    body:
      `Votre vérification « ${VERIFICATION_TYPE_LABELS[type]} » a été approuvée` +
      (expiresAt ? `, jusqu'au ${date(expiresAt)}.` : "."),
  }),
  rejected: (
    type: VerificationType,
    code: string,
    message: string | null,
  ): NotificationText => ({
    title: "Vérification non validée",
    body: `Dossier « ${VERIFICATION_TYPE_LABELS[type]} » : ${withReason(code, message)} Vous pouvez déposer un nouveau dossier.`,
  }),
  revoked: (
    type: VerificationType,
    code: string,
    message: string | null,
  ): NotificationText => ({
    title: "Vérification retirée",
    body: `Vérification « ${VERIFICATION_TYPE_LABELS[type]} » : ${withReason(code, message)}`,
  }),
  expired: (type: VerificationType): NotificationText => ({
    title: "Vérification expirée",
    body: `Votre vérification « ${VERIFICATION_TYPE_LABELS[type]} » est arrivée à échéance. Vous pouvez la renouveler.`,
  }),
}

export const reportNotice = {
  received: (): NotificationText => ({
    title: "Signalement reçu",
    body: "Merci. Votre signalement sera examiné par notre équipe.",
  }),
  processed: (): NotificationText => ({
    title: "Signalement examiné",
    body: "Votre signalement a été examiné. Merci de votre contribution.",
  }),
  listingSuspended: (title: string): NotificationText => ({
    title: "Annonce suspendue",
    body: `Votre annonce « ${title} » a été suspendue à la suite d'un examen. Contactez le support pour en connaître les suites possibles.`,
  }),
}
