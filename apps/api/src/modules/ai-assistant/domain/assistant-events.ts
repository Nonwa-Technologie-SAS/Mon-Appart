export const AssistantEvent = {
  TURN_COMPLETED: "assistant.turn_completed",
  FEEDBACK: "assistant.feedback",
} as const

export interface AssistantTurnPayload {
  conversationId: string
  mode: "clarify" | "results" | "empty" | "error"
  provider: "rules" | "openai" | "degraded"
  promptVersion: string
  listingCount: number
  fallback: boolean
  injectionSuspected: boolean
}

export interface AssistantFeedbackPayload {
  rating: "helpful" | "not_helpful" | "wrong_results"
  promptVersion: string
}
