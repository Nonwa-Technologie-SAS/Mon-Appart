/**
 * Événements de domaine, publiés en processus après commit. Charges utiles
 * minimales : identifiants publics et champs modifiés, jamais d'adresse ni de
 * donnée personnelle. Ils passeront par l'outbox puis Kafka (voir ADR 0005).
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
