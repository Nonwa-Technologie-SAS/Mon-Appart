export * from "./search"
export * from "./recommendation"

/** Codes de la table `roles` (seed de référence de l'API). */
export const ROLES = [
  "CUSTOMER",
  "OWNER",
  "AGENT",
  "AGENCY",
  "MODERATOR",
  "TRUST_OFFICER",
  "SUPPORT",
  "ANALYST",
  "ADMIN",
  "SUPER_ADMIN",
] as const

export type Role = (typeof ROLES)[number]

/** Offre commerciale. Distincte du bien physique. */
export const LISTING_TYPES = [
  "RENT",
  "SALE",
  "SHORT_TERM_RENT",
  "LEASE_TO_OWN",
] as const

export type ListingType = (typeof LISTING_TYPES)[number]

export type DependencyStatus = "up" | "down"

export interface DependencyCheck {
  status: DependencyStatus
  detail?: string
}

export interface HealthReport {
  status: "ok" | "degraded"
  service: string
  checks: Record<string, DependencyCheck>
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

/**
 * Files BullMQ prévues. Les workers ne consomment pour l'instant que
 * `system.ping` : les autres files seront branchées avec leur premier cas d'usage.
 */
export const JOB_QUEUES = {
  imageProcessing: "media.images",
  notifications: "communication.notifications",
  searchIndexing: "search.index",
  recommendations: "recommendation.compute",
  alerts: "listing.alerts",
  fraudSignals: "trust.fraud",
  systemPing: "system.ping",
} as const

export type JobQueueName = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES]

export interface JobPublisher {
  enqueue(
    queue: JobQueueName,
    name: string,
    payload: Record<string, unknown>,
  ): Promise<void>
}
