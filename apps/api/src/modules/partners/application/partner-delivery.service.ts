import { Injectable, Logger } from "@nestjs/common"

import { OnEvents } from "../../../common/events/on-events.decorator"
import type { DomainEvent } from "../../../common/events/domain-event"
import { ListingEvent } from "../../listing/domain/listing-events"
import { PartnersRepository } from "../infrastructure/partners.repository"

type ListingPayload = {
  listingId?: string
  from?: string
  to?: string
  status?: string
  previousStatus?: string
}

/**
 * Enfile des livraisons outbound pour les intégrations WEBHOOK_OUT actives.
 * Ne bloque jamais la publication d’annonce.
 */
@Injectable()
export class PartnerDeliveryService {
  private readonly logger = new Logger(PartnerDeliveryService.name)

  constructor(private readonly repository: PartnersRepository) {}

  @OnEvents(
    [
      ListingEvent.PUBLISHED,
      ListingEvent.PAUSED,
      ListingEvent.EXPIRED,
      ListingEvent.SOLD,
      ListingEvent.RENTED,
      ListingEvent.STATUS_CHANGED,
    ],
    { async: true },
  )
  async onListingEvent(event: DomainEvent<ListingPayload>): Promise<void> {
    try {
      await this.enqueue(event)
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "partner.enqueue_failed",
          event_id: event.id,
          message: error instanceof Error ? error.message : "unknown",
        }),
      )
    }
  }

  private async enqueue(event: DomainEvent<ListingPayload>): Promise<void> {
    const listingId = event.payload.listingId ?? event.aggregateId
    if (!listingId) return

    const integrations = await this.repository.listActiveWebhookOut()
    if (integrations.length === 0) return

    const eventName =
      event.name === ListingEvent.PUBLISHED
        ? "listing.published"
        : "listing.status_changed"

    for (const integration of integrations) {
      if (!integration.capabilities.includes(eventName)) continue
      try {
        await this.repository.enqueueDelivery({
          partnerId: integration.partnerId,
          integrationId: integration.id,
          eventName,
          eventId: event.id,
          payload: {
            event: eventName,
            eventId: event.id,
            occurredAt: event.occurredAt,
            listingId,
            status: event.payload.to ?? event.payload.status ?? null,
            previousStatus:
              event.payload.from ?? event.payload.previousStatus ?? null,
            partnerCode: integration.partner.code,
            contractVersion: integration.contractVersion,
          },
        })
      } catch (error) {
        // Unique (integrationId, eventId) : rejeu d’événement ignoré.
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : ""
        if (code !== "P2002") throw error
      }
    }
  }
}
