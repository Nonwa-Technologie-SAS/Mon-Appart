import type { AppointmentStatus } from "../../../../generated/prisma/enums"
import type { ParticipantSide } from "../../messaging/domain/message-rules"

export type AppointmentAction =
  "CONFIRM" | "RESCHEDULE" | "CANCEL" | "COMPLETE" | "NO_SHOW"

export const APPOINTMENT_ACTIONS: readonly AppointmentAction[] = [
  "CONFIRM",
  "RESCHEDULE",
  "CANCEL",
  "COMPLETE",
  "NO_SHOW",
]

export const ACTIVE_STATUSES: readonly AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULE_REQUESTED",
]

/** Motifs d'annulation : codes seulement, jamais de texte libre. */
export const CANCELLATION_REASONS = [
  "SCHEDULE_CONFLICT",
  "NO_LONGER_INTERESTED",
  "PROPERTY_UNAVAILABLE",
  "OTHER",
] as const
export type CancellationReason = (typeof CANCELLATION_REASONS)[number]

export interface AppointmentState {
  status: AppointmentStatus
  scheduledAt: Date
  /** Partie qui a proposé la nouvelle date (RESCHEDULE_REQUESTED). */
  proposedBy: ParticipantSide | null
}

/**
 * Transitions permises. Une demande n'est jamais confirmée d'office : seul le
 * côté annonce confirme une demande, et une nouvelle date proposée doit être
 * acceptée par l'autre partie. Terminée / absent : côté annonce, après l'heure.
 */
export function canPerform(
  state: AppointmentState,
  side: ParticipantSide,
  action: AppointmentAction,
  now: Date,
): boolean {
  switch (action) {
    case "CONFIRM":
      if (state.status === "PENDING") return side === "LISTING_SIDE"
      if (state.status === "RESCHEDULE_REQUESTED") {
        return state.proposedBy !== null && state.proposedBy !== side
      }
      return false
    case "RESCHEDULE":
    case "CANCEL":
      return ACTIVE_STATUSES.includes(state.status)
    case "COMPLETE":
    case "NO_SHOW":
      return (
        state.status === "CONFIRMED" &&
        side === "LISTING_SIDE" &&
        now.getTime() >= state.scheduledAt.getTime()
      )
  }
}

export function availableActions(
  state: AppointmentState,
  side: ParticipantSide,
  now: Date,
): AppointmentAction[] {
  return APPOINTMENT_ACTIONS.filter((action) =>
    canPerform(state, side, action, now),
  )
}

/** Statut atteint par une action (RESCHEDULE : nouvelle date proposée). */
export function nextStatus(action: AppointmentAction): AppointmentStatus {
  switch (action) {
    case "CONFIRM":
      return "CONFIRMED"
    case "RESCHEDULE":
      return "RESCHEDULE_REQUESTED"
    case "CANCEL":
      return "CANCELLED"
    case "COMPLETE":
      return "COMPLETED"
    case "NO_SHOW":
      return "NO_SHOW"
  }
}

export type TimeCheck = "OK" | "TOO_SOON" | "TOO_FAR" | "INVALID"

/** Créneau futur, avec un préavis minimal et un horizon maximal. */
export function checkVisitTime(
  at: Date,
  now: Date,
  limits: { minNoticeMinutes: number; maxDaysAhead: number },
): TimeCheck {
  const time = at.getTime()
  if (!Number.isFinite(time)) return "INVALID"
  if (time < now.getTime() + limits.minNoticeMinutes * 60_000) {
    return "TOO_SOON"
  }
  if (time > now.getTime() + limits.maxDaysAhead * 86_400_000) return "TOO_FAR"
  return "OK"
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(timeZone)) return false
  try {
    new Intl.DateTimeFormat("en", { timeZone })
    return true
  } catch {
    return false
  }
}
