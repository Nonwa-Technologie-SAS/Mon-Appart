import type {
  ListingStatus,
  ListingType,
} from "../../../generated/prisma/enums"
import { listingError, ListingErrorCode } from "./listing-errors"

/**
 * Qui déclenche une transition :
 * - `manager` : propriétaire / mandataire du bien avec la permission, ou admin ;
 * - `moderator` : permission de modération indiquée ;
 * - `system` : tâche planifiée (expiration).
 */
export type TransitionActor =
  | { kind: "manager" }
  | { kind: "moderator"; permission: "listing:moderate" | "listing:suspend" }
  | { kind: "system" }

const MANAGER: TransitionActor = { kind: "manager" }
const MODERATE: TransitionActor = {
  kind: "moderator",
  permission: "listing:moderate",
}
const SUSPEND: TransitionActor = {
  kind: "moderator",
  permission: "listing:suspend",
}
const SYSTEM: TransitionActor = { kind: "system" }

/** Matrice des transitions autorisées. Toute paire absente est refusée. */
export const LISTING_TRANSITIONS: Record<
  ListingStatus,
  Partial<Record<ListingStatus, readonly TransitionActor[]>>
> = {
  DRAFT: {
    PENDING_REVIEW: [MANAGER],
    PUBLISHED: [MANAGER],
    ARCHIVED: [MANAGER],
  },
  PENDING_REVIEW: {
    PUBLISHED: [MODERATE],
    DRAFT: [MANAGER, MODERATE],
    ARCHIVED: [MANAGER],
  },
  PUBLISHED: {
    PAUSED: [MANAGER],
    RENTED: [MANAGER],
    SOLD: [MANAGER],
    EXPIRED: [SYSTEM],
    SUSPENDED: [SUSPEND],
    ARCHIVED: [MANAGER],
  },
  PAUSED: {
    PUBLISHED: [MANAGER],
    RENTED: [MANAGER],
    SOLD: [MANAGER],
    SUSPENDED: [SUSPEND],
    ARCHIVED: [MANAGER],
  },
  SUSPENDED: {
    PUBLISHED: [SUSPEND],
    DRAFT: [SUSPEND],
    ARCHIVED: [MANAGER, SUSPEND],
  },
  EXPIRED: {
    PENDING_REVIEW: [MANAGER],
    PUBLISHED: [MANAGER],
    ARCHIVED: [MANAGER],
  },
  RENTED: { ARCHIVED: [MANAGER] },
  SOLD: { ARCHIVED: [MANAGER] },
  ARCHIVED: {},
}

/** Issue commerciale possible selon le type d'offre. */
const OUTCOMES: Record<ListingType, readonly ListingStatus[]> = {
  SALE: ["SOLD"],
  RENT: ["RENTED"],
  LEASE_TO_OWN: ["SOLD", "RENTED"],
  SHORT_TERM_RENT: [],
}

/** Statuts qui occupent le créneau « une annonce en cours par type ». */
export const LIVE_STATUSES: readonly ListingStatus[] = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
]

/** Statuts finaux : l'annonce n'est plus modifiable. */
export const CLOSED_STATUSES: readonly ListingStatus[] = [
  "SOLD",
  "RENTED",
  "ARCHIVED",
]

/**
 * Valide la transition et renvoie les acteurs qui peuvent la déclencher.
 * Lève l'erreur la plus parlante quand elle est refusée.
 */
export function transitionActors(
  from: ListingStatus,
  to: ListingStatus,
  listingType: ListingType,
): readonly TransitionActor[] {
  if (from === to) {
    if (to === "PUBLISHED")
      throw listingError(ListingErrorCode.LISTING_ALREADY_PUBLISHED)
    if (to === "SOLD" || to === "RENTED") {
      throw listingError(ListingErrorCode.LISTING_ALREADY_SOLD)
    }
    throw listingError(
      ListingErrorCode.INVALID_LISTING_STATUS_TRANSITION,
      `${from} → ${to}`,
    )
  }
  if ((from === "SOLD" || from === "RENTED") && to !== "ARCHIVED") {
    throw listingError(ListingErrorCode.LISTING_ALREADY_SOLD)
  }
  const actors = LISTING_TRANSITIONS[from][to]
  if (!actors) {
    throw listingError(
      ListingErrorCode.INVALID_LISTING_STATUS_TRANSITION,
      `${from} → ${to}`,
    )
  }
  if (
    (to === "SOLD" || to === "RENTED") &&
    !OUTCOMES[listingType].includes(to)
  ) {
    throw listingError(
      ListingErrorCode.INVALID_LISTING_STATUS_TRANSITION,
      `${to} impossible pour ${listingType}`,
    )
  }
  return actors
}

export function isTransitionAllowed(
  from: ListingStatus,
  to: ListingStatus,
  listingType: ListingType,
): boolean {
  try {
    transitionActors(from, to, listingType)
    return true
  } catch {
    return false
  }
}
