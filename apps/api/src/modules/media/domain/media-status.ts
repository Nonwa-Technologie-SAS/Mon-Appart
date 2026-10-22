import type { MediaStatus } from "../../../generated/prisma/enums"

/**
 * Cycle de vie d'un média. La suppression est portée par `deleted_at`, pas
 * par un statut ; READY, FAILED et REJECTED sont finaux.
 *
 * PENDING_UPLOAD → UPLOADED (confirmation vérifiée) | REJECTED | FAILED (session expirée)
 * UPLOADED       → PROCESSING (pris par un worker)
 * PROCESSING     → READY | REJECTED | FAILED | UPLOADED (nouvel essai)
 */
const TRANSITIONS: Record<MediaStatus, readonly MediaStatus[]> = {
  PENDING_UPLOAD: ["UPLOADED", "REJECTED", "FAILED"],
  UPLOADED: ["PROCESSING"],
  PROCESSING: ["READY", "REJECTED", "FAILED", "UPLOADED"],
  READY: [],
  FAILED: [],
  REJECTED: [],
}

export function canTransition(from: MediaStatus, to: MediaStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Une confirmation sur ces statuts est une répétition : réponse identique, aucun effet. */
export function isPastUpload(status: MediaStatus): boolean {
  return status !== "PENDING_UPLOAD"
}

/** Attente avant l'essai suivant : 30 s, 1 min, 2 min... plafonnée à 30 min. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000)
}
