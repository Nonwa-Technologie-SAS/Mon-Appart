import type { ConfigService } from "@nestjs/config"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { MetricsService } from "../../../observability/metrics.service"
import { AssistantService } from "./assistant.service"
import { AiAssistantConfig } from "../ai-assistant.config"
import { ConversationStore } from "../infrastructure/conversation.store"
import { RulesAiProvider } from "../infrastructure/rules-ai.provider"
import { OpenAiTextProvider } from "../infrastructure/openai-ai.provider"

function mockConfig(
  overrides: Partial<AiAssistantConfig> = {},
): AiAssistantConfig {
  return {
    enabled: true,
    provider: "rules",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    timeoutMs: 8000,
    maxTokens: 400,
    maxMessageLength: 2000,
    maxHistoryTurns: 12,
    conversationTtlMs: 86_400_000,
    searchLimit: 12,
    openaiReady: false,
    ...overrides,
  } as AiAssistantConfig
}

describe("AssistantService", () => {
  let search: { search: ReturnType<typeof vi.fn> }
  let service: AssistantService
  let store: ConversationStore

  beforeEach(() => {
    const config = mockConfig()
    store = new ConversationStore(config)
    const rules = new RulesAiProvider()
    search = {
      search: vi.fn().mockResolvedValue({
        items: [
          {
            listingId: "11111111-1111-4111-8111-111111111111",
            propertyId: "22222222-2222-4222-8222-222222222222",
            title: "Maison 3 ch. Cocody",
            listingType: "RENT",
            propertyType: { code: "HOUSE", name: "Maison" },
            price: { amount: 200_000, currency: "XOF", period: "MONTH" },
            surface: 120,
            bedrooms: 3,
            bathrooms: 2,
            location: {
              city: { code: "ABIDJAN", name: "Abidjan" },
              commune: { code: "COCODY", name: "Cocody" },
              neighborhood: { code: "RIVIERA", name: "Riviera" },
              latitude: null,
              longitude: null,
              precision: "NONE",
            },
            mainImage: null,
            score: null,
            distance: null,
            publishedAt: new Date().toISOString(),
          },
        ],
      }),
    }
    service = new AssistantService(
      config,
      store,
      search as never,
      rules,
      new OpenAiTextProvider(config, rules),
      new MetricsService({ get: () => "false" } as unknown as ConfigService),
      { publish: vi.fn() } as unknown as DomainEventPublisher,
    )
  })

  const ctx = {
    user: undefined,
    requestId: "req-1",
    sessionKey: "anon:test-session",
  }

  it("clarifie une location Abidjan sans budget", async () => {
    const result = await service.turn(
      null,
      "Je veux louer un appartement à Abidjan.",
      ctx,
    )
    expect(result.mode).toBe("clarify")
    expect(result.message).toMatch(/commune|quartier|budget/i)
    expect(search.search).not.toHaveBeenCalled()
    expect(result.listings).toEqual([])
  })

  it("lance Search pour une demande complète Cocody", async () => {
    const result = await service.turn(
      null,
      "Je cherche une maison de 3 chambres à louer à Cocody, budget 250 000 FCFA par mois maximum.",
      ctx,
    )
    expect(result.mode).toBe("results")
    expect(search.search).toHaveBeenCalledOnce()
    const params = search.search.mock.calls[0]![0] as Record<string, string>
    expect(params.listingType).toContain("RENT")
    expect(params.commune).toContain("COCODY")
    expect(params.maxPrice).toBe("250000")
    expect(params.bedrooms).toBe("3")
    expect(result.listings).toHaveLength(1)
    expect(result.listings[0]!.listingId).toBe(
      "11111111-1111-4111-8111-111111111111",
    )
    expect(
      result.listings[0]!.matchReasons.some((r) => /budget/i.test(r)),
    ).toBe(true)
  })

  it("isole les conversations par session", async () => {
    const a = await service.turn(null, "louer studio Cocody max 150000", {
      ...ctx,
      sessionKey: "anon:a",
    })
    try {
      service.getConversation(a.conversationId, {
        ...ctx,
        sessionKey: "anon:b",
      })
      expect.unreachable("devrait refuser l’accès")
    } catch (err) {
      expect(err).toMatchObject({ code: "ASSISTANT_CONVERSATION_NOT_FOUND" })
    }
  })

  it("forceSearch ignore la clarification budget", async () => {
    const result = await service.turn(
      null,
      "Je veux louer un appartement à Cocody.",
      ctx,
      { forceSearch: true },
    )
    expect(search.search).toHaveBeenCalled()
    expect(result.mode).toBe("results")
  })

  it("mode degraded si Search échoue", async () => {
    search.search.mockRejectedValueOnce(new Error("timeout"))
    const result = await service.turn(
      null,
      "maison à louer Cocody budget 200000 par mois",
      ctx,
    )
    expect(result.mode).toBe("error")
    expect(result.provider).toBe("degraded")
    expect(result.searchParams.maxPrice).toBe("200000")
  })
})
