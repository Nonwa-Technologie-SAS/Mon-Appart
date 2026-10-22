import { Injectable, Logger } from "@nestjs/common"
import {
  EVENTS,
  validateEvent,
  type EventDefinition,
  type EventProperties,
  type ServerEventName,
} from "@mon-appart/analytics"

import { safeErrorMessage } from "../../../common/http/safe-error"
import type { Prisma } from "../../../generated/prisma/client"
import { MetricsService } from "../../../observability/metrics.service"
import { AnalyticsConfig } from "../analytics.config"
import { AnalyticsRepository } from "../infrastructure/analytics.repository"

export interface TrackContext {
  /** Identifiant d'idempotence (déterministe pour un fait métier). */
  eventId: string
  userId: bigint | null
  occurredAt?: Date
  requestId?: string | null
  /** Évite une relecture quand l'appelant connaît déjà l'annonce. */
  listingId?: bigint | null
}

/**
 * Enregistre un événement métier confirmé (après commit). Ne lève jamais :
 * une panne d'Analytics n'affecte pas l'action principale. Base légale :
 * intérêt légitime, données pseudonymisées (identifiant interne, pas de
 * coordonnée, propriétés du catalogue uniquement).
 */
@Injectable()
export class AnalyticsTracker {
  private readonly logger = new Logger("AnalyticsTracker")

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly config: AnalyticsConfig,
    private readonly metrics: MetricsService,
  ) {}

  async track<TName extends ServerEventName>(
    name: TName,
    properties: EventProperties<TName>,
    context: TrackContext,
  ): Promise<boolean> {
    if (!this.config.enabled) return false
    try {
      const definition: EventDefinition = EVENTS[name]
      const validation = validateEvent(
        name,
        definition.version,
        properties,
        "server",
      )
      if (!validation.ok) {
        this.fail(name, `invalid:${validation.reason}`)
        return false
      }
      let listingId = context.listingId ?? null
      const key = definition.listingKey
      if (listingId === null && key) {
        const publicId = String(validation.properties[key])
        const listings = await this.repository.listingsByPublicId([publicId])
        listingId = listings.get(publicId)?.id ?? null
      }
      const now = new Date()
      const inserted = await this.repository.insertEvents([
        {
          eventId: context.eventId,
          name,
          schemaVersion: definition.version,
          source: "BACKEND",
          basis: "LEGITIMATE_INTEREST",
          policyVersion: null,
          occurredAt: context.occurredAt ?? now,
          receivedAt: now,
          userId: context.userId,
          anonymousId: null,
          sessionId: null,
          listingId,
          properties: validation.properties as Prisma.InputJsonObject,
          requestId: context.requestId ?? null,
          appVersion: null,
        },
      ])
      const outcome = inserted.size > 0 ? "accepted" : "duplicate"
      this.metrics.analytics.events.inc({ source: "backend", outcome })
      return inserted.size > 0
    } catch (error) {
      this.fail(name, safeErrorMessage(error))
      return false
    }
  }

  private fail(name: string, error: string): void {
    this.metrics.analytics.trackingFailures.inc()
    this.logger.warn(
      JSON.stringify({ action: "analytics.track_failed", event: name, error }),
    )
  }
}
