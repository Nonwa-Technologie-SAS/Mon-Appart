import type { AssistantCriteria, AssistantListingCard } from "../domain/assistant-criteria"

export type AiProviderName = "rules" | "openai" | "degraded"

export interface ComposeReplyInput {
  mode: "clarify" | "results" | "empty"
  baseMessage: string
  criteria: AssistantCriteria
  listings: AssistantListingCard[]
}

export interface AiTextProvider {
  readonly name: AiProviderName
  /** Reformule éventuellement le message ; ne doit pas inventer d’annonces. */
  composeReply(input: ComposeReplyInput): Promise<string>
}
