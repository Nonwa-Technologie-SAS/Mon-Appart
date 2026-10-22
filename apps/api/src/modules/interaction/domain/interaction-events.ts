import type { TrafficSource } from "../../../generated/prisma/client"

/**
 * Événements d’interaction (favoris, vues). Identifiants publics seulement.
 * Analytics et Recommendation réagissent sans dépendre du module Interaction.
 */
export const InteractionEvent = {
  FAVORITE_ADDED: "interaction.favorite_added",
  FAVORITE_REMOVED: "interaction.favorite_removed",
  PROPERTY_VIEWED: "interaction.property_viewed",
} as const

export interface FavoriteChangedPayload {
  userId: string
  listingId: string
  propertyId: string
}

export interface PropertyViewedPayload {
  userId: string | null
  listingId: string
  propertyId: string
  source: TrafficSource
  durationMs: number | null
  sessionId: string | null
}
