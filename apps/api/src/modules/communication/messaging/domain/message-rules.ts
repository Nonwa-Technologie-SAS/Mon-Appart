export const MAX_BODY_LENGTH = 4000
/** En dessous, un texte répété (« Bonjour », « Merci ») n'est pas suspect. */
export const REPEAT_MIN_LENGTH = 20
export const REPEAT_WINDOW_MS = 60 * 60 * 1000

/** Codes des messages SYSTEM, produits par le backend uniquement. */
export const SystemCode = {
  APPOINTMENT_REQUESTED: "APPOINTMENT_REQUESTED",
  APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
  APPOINTMENT_RESCHEDULE_PROPOSED: "APPOINTMENT_RESCHEDULE_PROPOSED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED",
  APPOINTMENT_NO_SHOW: "APPOINTMENT_NO_SHOW",
  CONVERSATION_CLOSED: "CONVERSATION_CLOSED",
} as const
export type SystemCode = (typeof SystemCode)[keyof typeof SystemCode]

export type ParticipantSide = "REQUESTER" | "LISTING_SIDE"
export type MessageStatus = "SENT" | "DELIVERED" | "READ"

// Caractères de contrôle sauf tabulation et saut de ligne ; caractères
// invisibles de direction (usurpation visuelle de liens).
const CONTROL =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

/**
 * Corps normalisé : fins de ligne unifiées, contrôles retirés, espaces de
 * bord supprimés, au plus 3 sauts de ligne consécutifs. `null` si vide.
 */
export function normalizeBody(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const text = raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
  return text.length > 0 ? text : null
}

/** Empreinte de comparaison pour la détection de messages répétés. */
export function repetitionKey(body: string): string {
  return body.toLowerCase().replace(/\s+/g, " ").trim()
}

/** Prénom et initiale : jamais l'e-mail ni le téléphone. */
export function displayName(
  user: { firstName: string | null; lastName: string | null } | null,
): string {
  if (!user) return "Compte supprimé"
  const first = user.firstName?.trim()
  const initial = user.lastName?.trim().charAt(0)
  if (first) return initial ? `${first} ${initial.toUpperCase()}.` : first
  return "Utilisateur"
}

/**
 * Statut d'un message vu par son auteur, d'après les curseurs des autres
 * participants : lu ou reçu dès qu'un interlocuteur l'a lu ou reçu.
 */
export function messageStatus(
  seq: number,
  counterpart: { readSeq: number; deliveredSeq: number },
): MessageStatus {
  if (counterpart.readSeq >= seq) return "READ"
  if (counterpart.deliveredSeq >= seq) return "DELIVERED"
  return "SENT"
}

/** Clé de regroupement : une notification par série non lue. */
export function messageDedupKey(
  conversationPublicId: string,
  recipientLastReadSeq: number,
): string {
  return `conversation:${conversationPublicId}:after:${recipientLastReadSeq}`
}
