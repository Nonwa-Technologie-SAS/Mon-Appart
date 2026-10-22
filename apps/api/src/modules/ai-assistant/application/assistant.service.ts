import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { AppException } from "../../../common/http/app-exception"
import type { AuthenticatedUser } from "../../identity"
import { SearchService } from "../../search/application/search.service"
import { AiAssistantConfig } from "../ai-assistant.config"
import type {
  AssistantCriteria,
  AssistantTurnResult,
} from "../domain/assistant-criteria"
import { extractCriteria, mergeCriteria } from "../domain/criteria-extractor"
import {
  criteriaToSearchParams,
  searchParamsAsRecord,
} from "../domain/criteria-to-search"
import {
  buildResultsMessage,
  emptySuggestions,
  toListingCards,
} from "../domain/explain-matches"
import type { AiTextProvider } from "../infrastructure/ai-provider"
import {
  ConversationStore,
  type AssistantConversation,
} from "../infrastructure/conversation.store"
import { OpenAiTextProvider } from "../infrastructure/openai-ai.provider"
import { RulesAiProvider } from "../infrastructure/rules-ai.provider"

export interface AssistantTurnContext {
  user: AuthenticatedUser | undefined
  requestId: string | null
  sessionKey: string
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name)

  constructor(
    private readonly config: AiAssistantConfig,
    private readonly store: ConversationStore,
    private readonly search: SearchService,
    private readonly rules: RulesAiProvider,
    private readonly openai: OpenAiTextProvider,
  ) {}

  createConversation(ctx: AssistantTurnContext): { conversationId: string } {
    this.assertEnabled()
    const conv = this.store.create(ctx.user?.id ?? null, ctx.sessionKey)
    return { conversationId: conv.id }
  }

  listConversations(ctx: AssistantTurnContext) {
    this.assertEnabled()
    return this.store
      .listForOwner(ctx.user?.id ?? null, ctx.sessionKey)
      .map((c) => ({
        conversationId: c.id,
        updatedAt: new Date(c.updatedAt).toISOString(),
        messageCount: c.messages.length,
        preview:
          c.messages.find((m) => m.role === "user")?.content.slice(0, 80) ??
          null,
      }))
  }

  getConversation(conversationId: string, ctx: AssistantTurnContext) {
    this.assertEnabled()
    const conv = this.requireConversation(conversationId, ctx)
    return {
      conversationId: conv.id,
      criteria: conv.criteria,
      listingIds: conv.listingIds,
      compareIds: conv.compareIds,
      messages: conv.messages,
    }
  }

  deleteConversation(conversationId: string, ctx: AssistantTurnContext) {
    this.assertEnabled()
    const ok = this.store.delete(
      conversationId,
      ctx.user?.id ?? null,
      ctx.sessionKey,
    )
    if (!ok) {
      throw new AppException(
        "ASSISTANT_CONVERSATION_NOT_FOUND",
        HttpStatus.NOT_FOUND,
        "Conversation introuvable",
      )
    }
    return { deleted: true }
  }

  async turn(
    conversationId: string | null,
    message: string,
    ctx: AssistantTurnContext,
    options?: { forceSearch?: boolean; compareListingIds?: string[] },
  ): Promise<AssistantTurnResult> {
    this.assertEnabled()
    const trimmed = message?.trim() ?? ""
    if (!trimmed) {
      throw new AppException(
        "ASSISTANT_EMPTY_MESSAGE",
        HttpStatus.BAD_REQUEST,
        "Message vide",
      )
    }
    if (trimmed.length > this.config.maxMessageLength) {
      throw new AppException(
        "ASSISTANT_MESSAGE_TOO_LONG",
        HttpStatus.BAD_REQUEST,
        `Message trop long (max ${this.config.maxMessageLength} caractères)`,
      )
    }

    let conv: AssistantConversation
    if (conversationId) {
      conv = this.requireConversation(conversationId, ctx)
    } else {
      conv = this.store.create(ctx.user?.id ?? null, ctx.sessionKey)
    }

    this.pushMessage(conv, "user", trimmed)

    let criteria: AssistantCriteria = conv.criteria
      ? mergeCriteria(conv.criteria, trimmed)
      : extractCriteria(trimmed)

    if (options?.forceSearch) {
      criteria = {
        ...criteria,
        acceptSearchWithoutBudget: true,
        acceptCityWide: true,
        clarificationQuestion: null,
      }
    }

    // Comparaison contrôlée (IDs fournis par le client, pas inventés).
    if (options?.compareListingIds?.length) {
      const allowed = new Set(conv.listingIds)
      conv.compareIds = options.compareListingIds
        .filter((id) => allowed.has(id))
        .slice(0, 4)
    }

    const provider = this.resolveProvider()

    // Clarification avant Search (sauf forceSearch / overrides accept*).
    if (criteria.clarificationQuestion && !options?.forceSearch) {
      return this.finishClarify(conv, criteria, provider)
    }

    const searchParams = criteriaToSearchParams(
      criteria,
      this.config.searchLimit,
    )
    const paramsRecord = searchParamsAsRecord(searchParams)

    try {
      const response = await this.search.search(searchParams, {
        user: ctx.user,
        requestId: ctx.requestId,
      })

      const cards = toListingCards(response.items, criteria)
      conv.criteria = criteria
      conv.listingIds = cards.map((c) => c.listingId)

      const mode = cards.length === 0 ? "empty" : "results"
      const base =
        mode === "empty"
          ? buildResultsMessage(0, criteria)
          : buildResultsMessage(cards.length, criteria)

      const compareNote =
        conv.compareIds.length >= 2
          ? this.buildCompareNote(cards, conv.compareIds)
          : ""

      const messageOut = await provider.composeReply({
        mode,
        baseMessage: base + (compareNote ? ` ${compareNote}` : ""),
        criteria,
        listings: cards,
      })

      this.pushMessage(conv, "assistant", messageOut)
      this.store.save(conv)

      return {
        mode,
        message: messageOut,
        criteria,
        searchParams: paramsRecord,
        listings: cards,
        suggestions:
          mode === "empty"
            ? emptySuggestions(criteria)
            : [
                "Affiner le budget",
                "Changer de commune",
                "Comparer deux biens sélectionnés",
              ],
        provider: provider.name,
        conversationId: conv.id,
      }
    } catch (err) {
      this.logger.warn(
        `Search via assistant échoué: ${err instanceof Error ? err.message : "error"}`,
      )
      conv.criteria = criteria
      const degradedMessage =
        "La recherche intelligente a rencontré un problème. Vos critères sont conservés ; utilisez la recherche classique avec les filtres ci-dessous."
      this.pushMessage(conv, "assistant", degradedMessage)
      this.store.save(conv)
      return {
        mode: "error",
        message: degradedMessage,
        criteria,
        searchParams: paramsRecord,
        listings: [],
        suggestions: ["Ouvrir la recherche classique"],
        provider: "degraded",
        conversationId: conv.id,
      }
    }
  }

  compare(
    conversationId: string,
    listingIds: string[],
    ctx: AssistantTurnContext,
  ): AssistantTurnResult {
    this.assertEnabled()
    const conv = this.requireConversation(conversationId, ctx)
    const allowed = new Set(conv.listingIds)
    const ids = listingIds.filter((id) => allowed.has(id)).slice(0, 4)
    if (ids.length < 2) {
      throw new AppException(
        "ASSISTANT_COMPARE_INVALID",
        HttpStatus.BAD_REQUEST,
        "Sélectionnez au moins 2 annonces parmi les résultats de cette conversation",
      )
    }
    conv.compareIds = ids
    const criteria = conv.criteria ?? extractCriteria("")
    const message =
      `Comparaison de ${ids.length} annonces de votre conversation. ` +
      "Les données affichées viennent uniquement des résultats Search déjà présentés. " +
      "Ouvrez chaque fiche pour le détail."
    this.pushMessage(conv, "assistant", message)
    this.store.save(conv)
    return {
      mode: "results",
      message,
      criteria,
      searchParams: {},
      listings: [],
      suggestions: ["Affiner la recherche"],
      provider: "rules",
      conversationId: conv.id,
    }
  }

  private async finishClarify(
    conv: AssistantConversation,
    criteria: AssistantCriteria,
    provider: AiTextProvider,
  ): Promise<AssistantTurnResult> {
    conv.criteria = criteria
    const base =
      criteria.clarificationQuestion ??
      "Pouvez-vous préciser votre recherche ?"
    const message = await provider.composeReply({
      mode: "clarify",
      baseMessage: base,
      criteria,
      listings: [],
    })
    this.pushMessage(conv, "assistant", message)
    this.store.save(conv)
    return {
      mode: "clarify",
      message,
      criteria,
      searchParams: searchParamsAsRecord(
        criteriaToSearchParams(criteria, this.config.searchLimit),
      ),
      listings: [],
      suggestions: this.clarifySuggestions(criteria),
      provider: provider.name,
      conversationId: conv.id,
    }
  }

  private clarifySuggestions(c: AssistantCriteria): string[] {
    const s: string[] = []
    if (c.listingTypes.length === 0) {
      s.push("Je veux louer", "Je veux acheter")
    }
    if (c.clarificationQuestion?.includes("budget")) {
      s.push("Budget max 200 000", "Sans budget")
    }
    if (c.clarificationQuestion?.includes("commune")) {
      s.push("Cocody", "Yopougon", "Tout Abidjan")
    }
    s.push("Lancer la recherche")
    return s.slice(0, 5)
  }

  private buildCompareNote(
    cards: ReturnType<typeof toListingCards>,
    compareIds: string[],
  ): string {
    const selected = cards.filter((c) => compareIds.includes(c.listingId))
    if (selected.length < 2) return ""
    const lines = selected.map((c) => {
      const price = c.price
        ? `${c.price.amount.toLocaleString("fr-FR")} ${c.price.currency}`
        : "prix non renseigné"
      return `${c.title} — ${price} — ${c.locationLabel}`
    })
    return `Comparaison : ${lines.join(" | ")}.`
  }

  private resolveProvider(): AiTextProvider {
    if (this.config.openaiReady) return this.openai
    return this.rules
  }

  private requireConversation(
    id: string,
    ctx: AssistantTurnContext,
  ): AssistantConversation {
    const conv = this.store.get(id, ctx.user?.id ?? null, ctx.sessionKey)
    if (!conv) {
      throw new AppException(
        "ASSISTANT_CONVERSATION_NOT_FOUND",
        HttpStatus.NOT_FOUND,
        "Conversation introuvable",
      )
    }
    return conv
  }

  private pushMessage(
    conv: AssistantConversation,
    role: "user" | "assistant",
    content: string,
  ): void {
    conv.messages.push({
      role,
      content,
      at: new Date().toISOString(),
    })
    const max = this.config.maxHistoryTurns * 2
    if (conv.messages.length > max) {
      conv.messages = conv.messages.slice(-max)
    }
  }

  private assertEnabled(): void {
    if (!this.config.enabled) {
      throw new AppException(
        "ASSISTANT_DISABLED",
        HttpStatus.SERVICE_UNAVAILABLE,
        "Assistant IA désactivé",
      )
    }
  }
}

/** Génère une clé de session anonyme stable côté client (header). */
export function newAnonymousSessionKey(): string {
  return randomUUID()
}
