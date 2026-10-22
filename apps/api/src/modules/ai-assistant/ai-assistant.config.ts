import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

export type AiAssistantProviderMode = "rules" | "openai"

/** Configuration assistant IA (`AI_ASSISTANT_*`, `OPENAI_*`). */
@Injectable()
export class AiAssistantConfig {
  readonly enabled: boolean
  readonly provider: AiAssistantProviderMode
  readonly openaiApiKey: string
  readonly openaiModel: string
  readonly timeoutMs: number
  readonly maxTokens: number
  readonly maxMessageLength: number
  readonly maxHistoryTurns: number
  readonly conversationTtlMs: number
  readonly searchLimit: number

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    this.enabled = config.get<string>("AI_ASSISTANT_ENABLED") !== "false"
    const provider = config.get<string>("AI_ASSISTANT_PROVIDER")?.trim()
    this.provider = provider === "openai" ? "openai" : "rules"
    this.openaiApiKey = config.get<string>("OPENAI_API_KEY")?.trim() ?? ""
    this.openaiModel =
      config.get<string>("AI_ASSISTANT_OPENAI_MODEL")?.trim() || "gpt-4o-mini"
    this.timeoutMs = num("AI_ASSISTANT_TIMEOUT_MS", 8_000)
    this.maxTokens = num("AI_ASSISTANT_MAX_TOKENS", 400)
    this.maxMessageLength = num("AI_ASSISTANT_MAX_MESSAGE_LENGTH", 2_000)
    this.maxHistoryTurns = num("AI_ASSISTANT_MAX_HISTORY_TURNS", 12)
    this.conversationTtlMs =
      num("AI_ASSISTANT_CONVERSATION_TTL_HOURS", 24) * 3_600_000
    this.searchLimit = num("AI_ASSISTANT_SEARCH_LIMIT", 12)
  }

  /** OpenAI réellement utilisable (clé + mode openai). */
  get openaiReady(): boolean {
    return this.provider === "openai" && this.openaiApiKey.length > 0
  }
}

export const aiAssistantRateLimit = (): number =>
  Number(process.env.AI_ASSISTANT_RATE_LIMIT) || 30
