import { Injectable, Logger } from "@nestjs/common"

import { AiAssistantConfig } from "../ai-assistant.config"
import type {
  AiTextProvider,
  ComposeReplyInput,
} from "./ai-provider"
import { RulesAiProvider } from "./rules-ai.provider"

/**
 * Reformulation optionnelle via OpenAI Chat Completions.
 * Extraction des critères = toujours règles Nest (pas ce provider).
 * Sans clé ou en échec → repli RulesAiProvider.
 */
@Injectable()
export class OpenAiTextProvider implements AiTextProvider {
  private readonly logger = new Logger(OpenAiTextProvider.name)
  readonly name = "openai" as const

  constructor(
    private readonly config: AiAssistantConfig,
    private readonly fallback: RulesAiProvider,
  ) {}

  async composeReply(input: ComposeReplyInput): Promise<string> {
    if (!this.config.openaiApiKey) {
      return this.fallback.composeReply(input)
    }

    const allowedIds = input.listings.map((l) => l.listingId)
    const catalog = input.listings.slice(0, 8).map((l) => ({
      listingId: l.listingId,
      title: l.title,
      price: l.price,
      locationLabel: l.locationLabel,
      matchReasons: l.matchReasons,
    }))

    const system = [
      "Tu es l’assistant immobilier Mon Appart (Côte d’Ivoire).",
      "Tu reformules UNIQUEMENT à partir des données fournies.",
      "Interdit : inventer une annonce, un prix, une disponibilité ou un quartier.",
      "Interdit : citer un listingId hors de la liste autorisée.",
      "Réponds en français, concis (4 phrases max).",
      `listingIds autorisés : ${allowedIds.join(", ") || "(aucun)"}`,
    ].join(" ")

    const user = JSON.stringify({
      mode: input.mode,
      baseMessage: input.baseMessage,
      criteriaSummary: {
        listingTypes: input.criteria.listingTypes,
        propertyTypes: input.criteria.propertyTypes,
        communes: input.criteria.communes,
        priceMax: input.criteria.priceMax,
        bedroomsMin: input.criteria.bedroomsMin,
      },
      listings: catalog,
    })

    try {
      const controller = new AbortController()
      const timer = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      )
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.openaiModel,
          temperature: 0.2,
          max_tokens: this.config.maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      })
      clearTimeout(timer)

      if (!res.ok) {
        this.logger.warn(`OpenAI HTTP ${res.status} — repli rules`)
        return this.fallback.composeReply(input)
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = json.choices?.[0]?.message?.content?.trim()
      if (!content) return this.fallback.composeReply(input)

      return this.sanitize(content, new Set(allowedIds), input.baseMessage)
    } catch (err) {
      this.logger.warn(
        `OpenAI indisponible — repli rules (${err instanceof Error ? err.message : "error"})`,
      )
      return this.fallback.composeReply(input)
    }
  }

  private sanitize(
    content: string,
    allowed: Set<string>,
    fallback: string,
  ): string {
    const uuidRe =
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
    let out = content
    for (const match of content.matchAll(uuidRe)) {
      if (!allowed.has(match[0]!)) {
        out = out.replaceAll(match[0]!, "")
      }
    }
    const cleaned = out.replace(/\s{2,}/g, " ").trim()
    return cleaned.length > 20 ? cleaned : fallback
  }
}
