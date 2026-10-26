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

export type AssistantCriteriaView = {
  listingTypes?: string[]
  propertyTypes?: string[]
  communes?: string[]
  neighborhoods?: string[]
  cities?: string[]
  priceMin?: number | null
  priceMax?: number | null
  pricePeriod?: string
  bedroomsMin?: number | null
  bathroomsMin?: number | null
  surfaceMin?: number | null
  surfaceMax?: number | null
  amenities?: string[]
  clarificationQuestion?: string | null
  acceptSearchWithoutBudget?: boolean
  acceptCityWide?: boolean
}

export type AssistantTurn = {
  mode: "clarify" | "results" | "empty" | "error"
  message: string
  criteria: AssistantCriteriaView
  searchParams: Record<string, string>
  listings: AssistantListingCard[]
  suggestions: string[]
  provider: "rules" | "openai" | "degraded"
  conversationId: string
}

/** Chips lisibles dérivées des critères Nest (jamais inventées). */
export function criteriaChips(
  criteria: AssistantCriteriaView | null | undefined,
): string[] {
  if (!criteria) return []
  const chips: string[] = []
  for (const t of criteria.listingTypes ?? []) {
    if (t === "RENT") chips.push("Location")
    else if (t === "SALE") chips.push("Achat")
    else if (t === "SHORT_TERM_RENT") chips.push("Courte durée")
    else chips.push(t)
  }
  for (const t of criteria.propertyTypes ?? []) {
    chips.push(propertyTypeLabel(t))
  }
  for (const c of criteria.communes ?? []) chips.push(c)
  for (const n of criteria.neighborhoods ?? []) chips.push(n)
  if (
    (criteria.cities?.length ?? 0) > 0 &&
    (criteria.communes?.length ?? 0) === 0
  ) {
    for (const city of criteria.cities ?? []) chips.push(city)
  }
  if (criteria.bedroomsMin != null) {
    chips.push(`${criteria.bedroomsMin}+ ch.`)
  }
  if (criteria.bathroomsMin != null) {
    chips.push(`${criteria.bathroomsMin}+ sdb`)
  }
  if (criteria.priceMax != null) {
    chips.push(
      `≤ ${formatXof(criteria.priceMax)}${periodSuffix(criteria.pricePeriod)}`,
    )
  } else if (criteria.priceMin != null) {
    chips.push(
      `≥ ${formatXof(criteria.priceMin)}${periodSuffix(criteria.pricePeriod)}`,
    )
  }
  if (criteria.surfaceMin != null) chips.push(`≥ ${criteria.surfaceMin} m²`)
  if (criteria.surfaceMax != null) chips.push(`≤ ${criteria.surfaceMax} m²`)
  for (const a of (criteria.amenities ?? []).slice(0, 3)) chips.push(a)
  return chips
}

function propertyTypeLabel(code: string): string {
  const map: Record<string, string> = {
    APARTMENT: "Appartement",
    HOUSE: "Maison",
    VILLA: "Villa",
    STUDIO: "Studio",
    LAND: "Terrain",
    OFFICE: "Bureau",
    COMMERCIAL: "Commerce",
  }
  return map[code.toUpperCase()] ?? code
}

function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F`
}

function periodSuffix(period?: string): string {
  if (period === "MONTH") return "/mois"
  if (period === "DAY") return "/jour"
  return ""
}

/** Intent de suggestion → action UI. */
export function suggestionAction(
  suggestion: string,
): "forceSearch" | "classic" | "message" {
  const lower = suggestion.toLowerCase()
  if (
    lower.includes("lancer") ||
    lower.includes("sans budget") ||
    lower.includes("tout abidjan") ||
    lower.includes("force")
  ) {
    return "forceSearch"
  }
  if (lower.includes("classique") || lower.includes("ouvrir la recherche")) {
    return "classic"
  }
  return "message"
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

async function assistantFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
