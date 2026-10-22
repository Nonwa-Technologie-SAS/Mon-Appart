import { beforeEach, describe, expect, it, vi } from "vitest"

import { InteractionService } from "./interaction.service"
import { InteractionEvent } from "../domain/interaction-events"

describe("InteractionService", () => {
  const listing = {
    listingId: 1n,
    listingPublicId: "11111111-1111-4111-8111-111111111111",
    propertyId: 2n,
    propertyPublicId: "22222222-2222-4222-8222-222222222222",
  }

  let repository: {
    findPublishedListing: ReturnType<typeof vi.fn>
    addFavorite: ReturnType<typeof vi.fn>
    removeFavorite: ReturnType<typeof vi.fn>
    recordView: ReturnType<typeof vi.fn>
    listFavorites: ReturnType<typeof vi.fn>
    isFavorite: ReturnType<typeof vi.fn>
  }
  let events: { publish: ReturnType<typeof vi.fn> }
  let service: InteractionService

  beforeEach(() => {
    repository = {
      findPublishedListing: vi.fn().mockResolvedValue(listing),
      addFavorite: vi.fn().mockResolvedValue(true),
      removeFavorite: vi.fn().mockResolvedValue(true),
      recordView: vi.fn().mockResolvedValue(undefined),
      listFavorites: vi.fn().mockResolvedValue([]),
      isFavorite: vi.fn().mockResolvedValue(false),
    }
    events = { publish: vi.fn() }
    const actors = {
      resolve: vi.fn().mockResolvedValue({
        userId: 9n,
        publicId: "user-public",
      }),
      resolveOptional: vi.fn().mockResolvedValue({
        userId: 9n,
        publicId: "user-public",
      }),
    }
    service = new InteractionService(
      repository as never,
      actors as never,
      events as never,
    )
  })

  const user = { id: "user-public", sessionId: "s", roles: [] as never[] }

  it("ajoute un favori et publie un événement", async () => {
    const result = await service.addFavorite(user, listing.listingPublicId)
    expect(result.created).toBe(true)
    expect(repository.addFavorite).toHaveBeenCalledWith(9n, 2n)
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: InteractionEvent.FAVORITE_ADDED }),
    )
  })

  it("n’émet pas d’événement si favori déjà présent", async () => {
    repository.addFavorite.mockResolvedValueOnce(false)
    await service.addFavorite(user, listing.listingPublicId)
    expect(events.publish).not.toHaveBeenCalled()
  })

  it("enregistre une vue avec source RECOMMENDATION", async () => {
    await service.recordView(user, {
      listingId: listing.listingPublicId,
      source: "RECOMMENDATION",
      durationMs: 1200,
    })
    expect(repository.recordView).toHaveBeenCalled()
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: InteractionEvent.PROPERTY_VIEWED }),
    )
  })

  it("refuse une source inconnue", async () => {
    await expect(
      service.recordView(user, {
        listingId: listing.listingPublicId,
        source: "BOT",
      }),
    ).rejects.toMatchObject({ code: "INVALID_VIEW" })
  })
})
