"use server"

import { getSession } from "@/lib/auth-session"
import { nestServerFetch } from "@/lib/nest-session"

export type FavoriteState = {
  favorited: boolean
  error?: string
  requiresAuth?: boolean
}

export async function getFavoriteStatus(
  listingId: string,
): Promise<FavoriteState> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { favorited: false, requiresAuth: true }
  }

  try {
    const result = await nestServerFetch<{ favorited: boolean }>(
      `/interactions/favorites/${listingId}`,
    )
    return { favorited: result.favorited }
  } catch {
    return { favorited: false }
  }
}

export async function toggleFavorite(
  listingId: string,
): Promise<FavoriteState> {
  const session = await getSession()
  if (!session?.user?.id) {
    return {
      favorited: false,
      requiresAuth: true,
      error: "Connectez-vous pour enregistrer un favori.",
    }
  }

  try {
    const current = await nestServerFetch<{ favorited: boolean }>(
      `/interactions/favorites/${listingId}`,
    )
    if (current.favorited) {
      const result = await nestServerFetch<{ favorited: boolean }>(
        `/interactions/favorites/${listingId}`,
        { method: "DELETE" },
      )
      return { favorited: result.favorited }
    }
    const result = await nestServerFetch<{ favorited: boolean }>(
      `/interactions/favorites/${listingId}`,
      { method: "POST" },
    )
    return { favorited: result.favorited }
  } catch (error) {
    return {
      favorited: false,
      error:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le favori.",
    }
  }
}
