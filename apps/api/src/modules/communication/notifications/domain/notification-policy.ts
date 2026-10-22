import type {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
} from "../../../../generated/prisma/enums"

export const CATEGORIES: readonly NotificationCategory[] = [
  "MESSAGES",
  "VISITS",
  "APPOINTMENT_REMINDERS",
  "RECOMMENDATIONS",
  "PRICE_DROPS",
  "SAVED_SEARCHES",
  "LISTING_UPDATES",
  "ACCOUNT",
  "MARKETING",
]

export const CHANNELS: readonly NotificationChannel[] = [
  "IN_APP",
  "EMAIL",
  "SMS",
  "PUSH",
  "WHATSAPP",
]

export type ExternalChannel = Exclude<NotificationChannel, "IN_APP">

export const EXTERNAL_CHANNELS: readonly ExternalChannel[] = [
  "EMAIL",
  "SMS",
  "PUSH",
  "WHATSAPP",
]

/**
 * Valeurs par défaut, sans choix enregistré. Le SMS reste réservé aux visites
 * (coût, canal moins sûr) ; le marketing exige un accord explicite.
 */
const DEFAULTS: Record<NotificationCategory, readonly NotificationChannel[]> = {
  MESSAGES: ["IN_APP", "EMAIL", "PUSH"],
  VISITS: ["IN_APP", "EMAIL", "SMS", "PUSH"],
  APPOINTMENT_REMINDERS: ["IN_APP", "EMAIL", "SMS", "PUSH"],
  RECOMMENDATIONS: ["IN_APP"],
  PRICE_DROPS: ["IN_APP", "PUSH"],
  SAVED_SEARCHES: ["IN_APP", "PUSH"],
  LISTING_UPDATES: ["IN_APP", "EMAIL"],
  ACCOUNT: ["IN_APP", "EMAIL", "PUSH"],
  MARKETING: [],
}

/**
 * Canaux qu'un utilisateur ne peut pas couper : l'historique in-app (hors
 * marketing) et l'e-mail des messages de compte (sécurité, vérifications).
 */
export function isLocked(
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  if (channel === "IN_APP") return category !== "MARKETING"
  return category === "ACCOUNT" && channel === "EMAIL"
}

export function defaultEnabled(
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return DEFAULTS[category].includes(channel)
}

/** Préférence effective : verrou, puis choix enregistré, puis défaut. */
export function isEnabled(
  category: NotificationCategory,
  channel: NotificationChannel,
  stored: ReadonlyMap<string, boolean>,
): boolean {
  if (isLocked(category, channel)) return true
  return (
    stored.get(preferenceKey(category, channel)) ??
    defaultEnabled(category, channel)
  )
}

export function preferenceKey(
  category: NotificationCategory,
  channel: NotificationChannel,
): string {
  return `${category}:${channel}`
}

/** Catégorie déduite du type pour les appelants qui ne la précisent pas. */
export function categoryOf(type: NotificationType): NotificationCategory {
  switch (type) {
    case "MESSAGE":
      return "MESSAGES"
    case "APPOINTMENT":
      return "VISITS"
    case "PRICE_DROP":
      return "PRICE_DROPS"
    case "NEW_RECOMMENDATION":
      return "RECOMMENDATIONS"
    case "NEW_PROPERTY":
      return "SAVED_SEARCHES"
    default:
      return "ACCOUNT"
  }
}

export interface RecipientContact {
  emailVerified: boolean
  phoneVerified: boolean
  activePushDevices: number
}

/** Le canal a une destination vérifiée : jamais d'envoi vers un contact non confirmé. */
export function hasDestination(
  channel: ExternalChannel,
  contact: RecipientContact,
): boolean {
  switch (channel) {
    case "EMAIL":
      return contact.emailVerified
    case "SMS":
    case "WHATSAPP":
      return contact.phoneVerified
    case "PUSH":
      return contact.activePushDevices > 0
  }
}

/**
 * Canaux externes à planifier : activés par l'utilisateur, servis par un
 * fournisseur configuré, avec une destination vérifiée. Un canal configuré
 * comme repli d'un canal planifié est différé : il n'est utilisé qu'après
 * l'échec définitif du canal principal.
 */
export function planChannels(input: {
  category: NotificationCategory
  stored: ReadonlyMap<string, boolean>
  available: ReadonlySet<ExternalChannel>
  contact: RecipientContact
  fallbacks?: ReadonlyMap<NotificationChannel, NotificationChannel>
}): ExternalChannel[] {
  const eligible = EXTERNAL_CHANNELS.filter(
    (channel) =>
      input.available.has(channel) &&
      isEnabled(input.category, channel, input.stored) &&
      hasDestination(channel, input.contact),
  )
  const targets = new Set(input.fallbacks?.values() ?? [])
  const deferred = new Set(
    eligible.flatMap((channel) => {
      const target = input.fallbacks?.get(channel)
      return target && !targets.has(channel) ? [target] : []
    }),
  )
  return eligible.filter((channel) => !deferred.has(channel))
}
