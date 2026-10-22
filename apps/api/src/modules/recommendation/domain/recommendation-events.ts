import type {
  RecommendationContext,
  RecommendationFeedbackType,
} from "@mon-appart/types"

/**
 * Événements publiés après le service d'une page ou l'enregistrement d'un
 * retour. Identifiants publics seulement : ni score, ni critère de l'utilisateur.
 */
export const RecommendationEvent = {
  SERVED: "recommendation.served",
  FEEDBACK: "recommendation.feedback",
} as const

export interface RecommendationServedPayload {
  /** `meta.requestId` de la réponse. */
  requestId: string
  context: RecommendationContext
  algorithmVersion: string
  itemCount: number
  userId: string | null
  httpRequestId: string | null
}

export interface RecommendationFeedbackPayload {
  recommendationId: string
  type: RecommendationFeedbackType
}
