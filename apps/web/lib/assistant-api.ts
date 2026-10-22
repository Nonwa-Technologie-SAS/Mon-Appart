/**
 * Client HTTP vers l’API Nest (`/api/v1/ai-assistant/*`).
 * Same-origin via rewrite Next ; aucune clé LLM ici.
 */

import { nestApiBaseUrl, nestApiUrl } from "@/lib/nest-url"

const SESSION_KEY = "mon-appart:assistant-session:v1"

export { nestApiBaseUrl } from "@/lib/nest-url"

export type AssistantListingCard = {
  listingId: string
  propertyId: string
  title: string
  listingType: string
  propertyType: { code: string; name: string }
  price: { amount: number; currency: string; period: string } | null
  surface: number | null
  bedrooms: number | null
  bathrooms: number | null
  locationLabel: string
  mainImage: string | null
  matchReasons: string[]
}

export type AssistantTurn = {
  mode: "clarify" | "results" | "empty" | "error"
  message: string
  criteria: Record<string, unknown>
  searchParams: Record<string, string>
  listings: AssistantListingCard[]
  suggestions: string[]
  provider: "rules" | "openai" | "degraded"
  conversationId: string
}

export function getAssistantSessionId(): string {
  if (typeof window === "undefined") return "ssr"
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

async function assistantFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (nestApiBaseUrl() === null) {
    throw new Error("NEST_API_UNCONFIGURED")
  }
  const res = await fetch(nestApiUrl(path), {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-assistant-session": getAssistantSessionId(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string
      code?: string
    } | null
    throw new Error(body?.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function sendNaturalSearch(
  query: string,
  options?: { forceSearch?: boolean },
): Promise<AssistantTurn> {
  return assistantFetch<AssistantTurn>("/api/v1/ai-assistant/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      forceSearch: options?.forceSearch ?? false,
    }),
  })
}

export function sendConversationMessage(
  conversationId: string,
  message: string,
  options?: { forceSearch?: boolean },
): Promise<AssistantTurn> {
  return assistantFetch<AssistantTurn>(
    `/api/v1/ai-assistant/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        forceSearch: options?.forceSearch ?? false,
      }),
    },
  )
}

/** Construit une URL de recherche classique à partir des critères Nest. */
export function classicSearchHref(params: Record<string, string>): string {
  const q = new URLSearchParams()
  if (params.q) q.set("q", params.q)
  if (params.maxPrice) q.set("maxPrice", params.maxPrice)
  if (params.propertyType) {
    const first = params.propertyType.split(",")[0]?.toLowerCase()
    if (first === "apartment") q.set("type", "APARTMENT")
    else if (first === "house") q.set("type", "HOUSE")
    else if (first === "studio") q.set("type", "STUDIO")
    else if (first === "villa") q.set("type", "VILLA")
    else if (first === "land") q.set("type", "LAND")
  }
  const qs = q.toString()
  return qs ? `/?${qs}` : "/locations"
}
