import { createHash } from "node:crypto"

export interface ClockWindow {
  /** Âge maximal accepté. */
  maxAgeMs: number
  /** Avance maximale tolérée après correction. */
  maxFutureMs: number
}

/**
 * Horodatage retenu pour un événement client : l'horloge de l'appareil est
 * corrigée du décalage mesuré entre `sentAt` et la réception, puis bornée.
 * `null` si l'événement est trop ancien ou dans le futur (rejeté).
 */
export function resolveOccurredAt(
  occurredAt: Date,
  sentAt: Date,
  receivedAt: Date,
  window: ClockWindow,
): Date | null {
  const skew = receivedAt.getTime() - sentAt.getTime()
  const corrected = new Date(occurredAt.getTime() + skew)
  if (corrected.getTime() > receivedAt.getTime() + window.maxFutureMs) {
    return null
  }
  if (receivedAt.getTime() - corrected.getTime() > window.maxAgeMs) return null
  // Légère avance tolérée : ramenée à l'instant de réception.
  return corrected.getTime() > receivedAt.getTime() ? receivedAt : corrected
}

/**
 * Identifiant d'événement déterministe (format UUID v4) : rejouer le même
 * fait métier produit le même `event_id`, donc aucun doublon à l'insertion.
 */
export function deterministicEventId(...parts: string[]): string {
  const hex = createHash("sha256").update(parts.join("\u001f")).digest("hex")
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-")
}

/** Jour UTC (minuit) d'une date. */
export function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * 86_400_000)
}

export function isoDay(day: Date): string {
  return day.toISOString().slice(0, 10)
}
