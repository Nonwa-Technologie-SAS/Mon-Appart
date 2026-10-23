import { nestServerFetch } from "@/lib/nest-session"

export type NestFavoriteItem = {
  listingId: string
  propertyId: string
  title: string
  createdAt: string
}

export async function listNestFavorites(): Promise<NestFavoriteItem[]> {
  try {
    const page = await nestServerFetch<{ items: NestFavoriteItem[] }>(
      "/interactions/favorites",
    )
    return page.items ?? []
  } catch {
    return []
  }
}
