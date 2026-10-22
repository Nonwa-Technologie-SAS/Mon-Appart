import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import type { TrafficSource } from "../../../generated/prisma/client"

import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import type { AuthenticatedUser } from "../../identity"
import { ActorService } from "../../identity"
import {
  InteractionEvent,
  type FavoriteChangedPayload,
  type PropertyViewedPayload,
} from "../domain/interaction-events"
import {
  InteractionErrorCode,
  interactionError,
} from "../domain/interaction-errors"
import { InteractionRepository } from "../infrastructure/interaction.repository"

const MAX_FAVORITES = 50
const MAX_DURATION_MS = 3_600_000
const SESSION_MAX = 64

const VIEW_SOURCES: ReadonlySet<string> = new Set([
  "SEARCH",
  "RECOMMENDATION",
  "DIRECT",
  "FAVORITE",
  "NOTIFICATION",
  "SHARE",
])

@Injectable()
export class InteractionService {
  constructor(
    private readonly repository: InteractionRepository,
    private readonly actors: ActorService,
    private readonly events: DomainEventPublisher,
  ) {}

  async addFavorite(
    user: AuthenticatedUser,
    listingPublicId: string,
  ): Promise<{ favorited: boolean; created: boolean }> {
    const actor = await this.actors.resolve(user)
    const listing = await this.requireListing(listingPublicId)
    const created = await this.repository.addFavorite(
      actor.userId,
      listing.propertyId,
    )
    if (created) {
      this.publishFavorite(
        InteractionEvent.FAVORITE_ADDED,
        actor.publicId,
        listing,
      )
    }
    return { favorited: true, created }
  }

  async removeFavorite(
    user: AuthenticatedUser,
    listingPublicId: string,
  ): Promise<{ favorited: boolean; removed: boolean }> {
    const actor = await this.actors.resolve(user)
    const listing = await this.requireListing(listingPublicId)
    const removed = await this.repository.removeFavorite(
      actor.userId,
      listing.propertyId,
    )
    if (removed) {
      this.publishFavorite(
        InteractionEvent.FAVORITE_REMOVED,
        actor.publicId,
        listing,
      )
    }
    return { favorited: false, removed }
  }

  async listFavorites(user: AuthenticatedUser) {
    const actor = await this.actors.resolve(user)
    const rows = await this.repository.listFavorites(actor.userId, MAX_FAVORITES)
    return {
      items: rows.map((row) => ({
        listingId: row.listingPublicId,
        propertyId: row.propertyPublicId,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  }

  async isFavorite(
    user: AuthenticatedUser,
    listingPublicId: string,
  ): Promise<{ favorited: boolean }> {
    const actor = await this.actors.resolve(user)
    const listing = await this.requireListing(listingPublicId)
    const favorited = await this.repository.isFavorite(
      actor.userId,
      listing.propertyId,
    )
    return { favorited }
  }

  async recordView(
    user: AuthenticatedUser | undefined,
    input: {
      listingId: string
      source?: string
      durationMs?: number | null
      sessionId?: string | null
    },
  ): Promise<{ recorded: true }> {
    const listing = await this.requireListing(input.listingId)
    const source = this.parseSource(input.source)
    const durationMs = this.parseDuration(input.durationMs)
    const sessionId = this.parseSession(input.sessionId)
    const actor = await this.actors.resolveOptional(user)

    await this.repository.recordView({
      userId: actor?.userId ?? null,
      propertyId: listing.propertyId,
      sessionId,
      source,
      durationMs,
    })

    this.events.publish({
      id: randomUUID(),
      name: InteractionEvent.PROPERTY_VIEWED,
      occurredAt: new Date().toISOString(),
      aggregateId: listing.listingPublicId,
      payload: {
        userId: actor?.publicId ?? null,
        listingId: listing.listingPublicId,
        propertyId: listing.propertyPublicId,
        source,
        durationMs,
        sessionId,
      } satisfies PropertyViewedPayload,
    })

    return { recorded: true }
  }

  private async requireListing(listingPublicId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        listingPublicId,
      )
    ) {
      throw interactionError(InteractionErrorCode.LISTING_NOT_FOUND)
    }
    const listing =
      await this.repository.findPublishedListing(listingPublicId)
    if (!listing) {
      throw interactionError(InteractionErrorCode.LISTING_NOT_FOUND)
    }
    return listing
  }

  private parseSource(raw: string | undefined): TrafficSource {
    const value = (raw ?? "DIRECT").toUpperCase()
    if (!VIEW_SOURCES.has(value)) {
      throw interactionError(
        InteractionErrorCode.INVALID_VIEW,
        "source inconnue",
      )
    }
    return value as TrafficSource
  }

  private parseDuration(raw: number | null | undefined): number | null {
    if (raw == null) return null
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_DURATION_MS) {
      throw interactionError(
        InteractionErrorCode.INVALID_VIEW,
        "durationMs hors bornes",
      )
    }
    return Math.round(raw)
  }

  private parseSession(raw: string | null | undefined): string | null {
    if (raw == null || raw === "") return null
    const trimmed = raw.trim()
    if (trimmed.length > SESSION_MAX) {
      throw interactionError(
        InteractionErrorCode.INVALID_VIEW,
        "sessionId trop long",
      )
    }
    return trimmed
  }

  private publishFavorite(
    name:
      | typeof InteractionEvent.FAVORITE_ADDED
      | typeof InteractionEvent.FAVORITE_REMOVED,
    userPublicId: string,
    listing: {
      listingPublicId: string
      propertyPublicId: string
    },
  ): void {
    this.events.publish({
      id: randomUUID(),
      name,
      occurredAt: new Date().toISOString(),
      aggregateId: listing.listingPublicId,
      payload: {
        userId: userPublicId,
        listingId: listing.listingPublicId,
        propertyId: listing.propertyPublicId,
      } satisfies FavoriteChangedPayload,
    })
  }
}
