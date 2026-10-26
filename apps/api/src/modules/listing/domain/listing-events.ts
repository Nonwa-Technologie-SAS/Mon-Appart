import type { ListingStatus } from "../../../generated/prisma/enums"

/**
 * Événements de domaine. Écrits dans l'outbox PostgreSQL dans la transaction
 * métier, puis publiés vers le bus en processus (ADR 0005 / 0014).
 */
export const ListingEvent = {
  CREATED: "listing.created",
  UPDATED: "listing.updated",
  PUBLISHED: "listing.published",
  PAUSED: "listing.paused",
  EXPIRED: "listing.expired",
  SOLD: "listing.sold",
  RENTED: "listing.rented",
  STATUS_CHANGED: "listing.status_changed",
  PRICE_CHANGED: "listing.price_changed",
  DELETED: "listing.deleted",
} as const

const EVENT_BY_STATUS: Partial<Record<ListingStatus, string>> = {
  PUBLISHED: ListingEvent.PUBLISHED,
  PAUSED: ListingEvent.PAUSED,
  EXPIRED: ListingEvent.EXPIRED,
  SOLD: ListingEvent.SOLD,
  RENTED: ListingEvent.RENTED,
}

export function eventForStatus(status: ListingStatus): string {
  return EVENT_BY_STATUS[status] ?? ListingEvent.STATUS_CHANGED
}

export const ListingAuditAction = {
  CREATED: "LISTING_CREATED",
  UPDATED: "LISTING_UPDATED",
  PUBLISHED: "LISTING_PUBLISHED",
  PAUSED: "LISTING_PAUSED",
  STATUS_CHANGED: "LISTING_STATUS_CHANGED",
  PRICE_CHANGED: "PRICE_CHANGED",
  DELETED: "LISTING_DELETED",
} as const

export function auditActionForStatus(status: ListingStatus): string {
  if (status === "PUBLISHED") return ListingAuditAction.PUBLISHED
  if (status === "PAUSED") return ListingAuditAction.PAUSED
  return ListingAuditAction.STATUS_CHANGED
}

export const LISTING_ENTITY = "listing"
