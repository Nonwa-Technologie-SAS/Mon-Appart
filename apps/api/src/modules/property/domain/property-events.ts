/**
 * Événements de domaine. Écrits dans l'outbox PostgreSQL dans la transaction
 * métier, puis publiés vers le bus en processus (ADR 0005 / 0014).
 */
export const PropertyEvent = {
  CREATED: "property.created",
  UPDATED: "property.updated",
  DELETED: "property.deleted",
} as const

export const PropertyAuditAction = {
  CREATED: "PROPERTY_CREATED",
  UPDATED: "PROPERTY_UPDATED",
  DELETED: "PROPERTY_DELETED",
  OWNERSHIP_CHANGED: "OWNERSHIP_CHANGED",
} as const

export const PROPERTY_ENTITY = "property"
