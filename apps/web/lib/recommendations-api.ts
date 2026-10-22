/**
 * Client Nest pour les recommandations personnalisées.
 * Same-origin via rewrite `/api/v1/*`.
 */

import { nestApiBaseUrl, nestApiUrl } from "@/lib/nest-url"

export type RecommendationReason = { code: string; label: string }

export type RecommendationCard = {
  id: string | null
  score: number
  reasons: RecommendationReason[]
  listing: {
    listingId: string
    title: string
    listingType: string
    propertyType: { code: string; name: string }
    price: { amount: number; currency: string; period: string } | null
    bedrooms: number | null
    surface: number | null
    location: {
      city: { name: string }
      commune: { name: string }
      neighborhood: { name: string }
    }
    mainImage: string | null
  }
}

export type RecommendationPage = {
  items: RecommendationCard[]
  meta: {
    level: "GENERIC" | "PREFERENCES" | "BEHAVIOR"
    algorithmVersion: string
    degraded: boolean
    requestId: string
    context: string
  }
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number }
}

export function recommendationsConfigured(): boolean {
  return nestApiBaseUrl() !== null
}

export async function fetchRecommendations(options?: {
  listingType?: string
  limit?: number
  accessToken?: string | null
}): Promise<RecommendationPage> {
  if (nestApiBaseUrl() === null) throw new Error("NEST_API_UNCONFIGURED")

  const params = new URLSearchParams()
  if (options?.listingType) params.set("listingType", options.listingType)
  params.set("limit", String(options?.limit ?? 12))

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const res = await fetch(
    nestApiUrl(`/api/v1/recommendations?${params}`),
    {
      headers,
      credentials: "same-origin",
      cache: "no-store",
    },
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json() as Promise<RecommendationPage>
}

export async function fetchSimilar(
  listingPublicId: string,
  limit = 6,
): Promise<RecommendationPage> {
  if (nestApiBaseUrl() === null) throw new Error("NEST_API_UNCONFIGURED")
  const res = await fetch(
    nestApiUrl(
      `/api/v1/recommendations/similar/${listingPublicId}?limit=${limit}`,
    ),
    {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<RecommendationPage>
}
