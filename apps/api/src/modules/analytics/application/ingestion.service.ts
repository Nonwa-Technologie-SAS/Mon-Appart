import { Injectable } from "@nestjs/common"
import {
  batchSchema,
  validateEvent,
  type RejectionReason,
} from "@mon-appart/analytics"
import { performance } from "node:perf_hooks"

import type { Prisma } from "../../../generated/prisma/client"
import type { AnalyticsSource } from "../../../generated/prisma/enums"
import { MetricsService } from "../../../observability/metrics.service"
import {
  ActorService,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { AnalyticsConfig } from "../analytics.config"
import { analyticsError } from "../domain/analytics-errors"
import { resolveOccurredAt } from "../domain/ingestion-rules"
import {
  AnalyticsRepository,
  type EventRow,
} from "../infrastructure/analytics.repository"
import { ConsentService } from "./consent.service"
import { IngestionStats } from "./ingestion-stats"

export type IngestRejection = RejectionReason | "out_of_window"
/** Événement valide mais non conservé, sans faute du client. */
export type IgnoreReason =
  "disabled" | "no_consent" | "listing_unavailable" | "own_listing"

export interface IngestResult {
  accepted: number
  duplicates: number
  rejected: Array<{ index: number; eventId: string; reason: IngestRejection }>
  ignored: number
}

interface Candidate {
  index: number
  eventId: string
  name: string
  version: number
  occurredAt: Date
  properties: Record<string, unknown>
  listingPublicId: string | null
}

const SOURCES: Record<"web" | "mobile", AnalyticsSource> = {
  web: "WEB",
  mobile: "MOBILE",
}

/**
 * Ingestion des lots client : schéma du catalogue, consentement, fenêtre
 * temporelle, annonce publiée, puis insertion idempotente (`event_id`).
 * Ne fait jamais confiance au client pour un fait métier : les événements
 * `origin: server` sont refusés.
 */
@Injectable()
export class IngestionService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly consents: ConsentService,
    private readonly actors: ActorService,
    private readonly stats: IngestionStats,
    private readonly config: AnalyticsConfig,
    private readonly metrics: MetricsService,
  ) {}

  async ingest(
    body: unknown,
    user: AuthenticatedUser | undefined,
    client: ClientContext,
    receivedAt = new Date(),
  ): Promise<IngestResult> {
    const started = performance.now()
    const parsed = batchSchema.safeParse(body)
    if (!parsed.success) {
      throw analyticsError(
        "ANALYTICS_BATCH_INVALID",
        parsed.error.issues[0]?.path.join(".") || "structure",
      )
    }
    const { context, events } = parsed.data
    const source = SOURCES[context.source]
    const result: IngestResult = {
      accepted: 0,
      duplicates: 0,
      rejected: [],
      ignored: 0,
    }

    const ignoreAll = (reason: IgnoreReason) => {
      result.ignored = events.length
      this.stats.record(source, "ignored", reason, events.length, receivedAt)
      return result
    }
    if (!this.config.enabled) return ignoreAll("disabled")

    const actor = await this.actors.resolveOptional(user)
    const declared =
      context.consent.analytics &&
      context.consent.policyVersion === this.config.policyVersion
    const consented =
      declared && (actor ? await this.consents.isGranted(actor.userId) : true)
    if (!consented) return ignoreAll("no_consent")

    const sentAt = new Date(context.sentAt)
    const candidates: Candidate[] = []
    events.forEach((event, index) => {
      const reject = (reason: IngestRejection) => {
        result.rejected.push({ index, eventId: event.eventId, reason })
      }
      const validation = validateEvent(
        event.name,
        event.schemaVersion,
        event.properties,
        "client",
      )
      if (!validation.ok) return reject(validation.reason)
      const occurredAt = resolveOccurredAt(
        new Date(event.occurredAt),
        sentAt,
        receivedAt,
        {
          maxAgeMs: this.config.maxEventAgeMs,
          maxFutureMs: this.config.maxFutureSkewMs,
        },
      )
      if (!occurredAt) return reject("out_of_window")
      const key = validation.definition.listingKey
      candidates.push({
        index,
        eventId: event.eventId,
        name: event.name,
        version: event.schemaVersion,
        occurredAt,
        properties: validation.properties,
        listingPublicId: key ? String(validation.properties[key]) : null,
      })
    })
    for (const rejection of result.rejected) {
      this.stats.record(source, "rejected", rejection.reason, 1, receivedAt)
    }

    const listings = await this.repository.listingsByPublicId(
      candidates.flatMap((c) => (c.listingPublicId ? [c.listingPublicId] : [])),
    )
    const managed = actor
      ? await this.repository.managedPropertyIds(
          actor.userId,
          [...listings.values()].map((listing) => listing.propertyId),
        )
      : new Set<bigint>()

    const rows: EventRow[] = []
    for (const candidate of candidates) {
      let listingId: bigint | null = null
      if (candidate.listingPublicId) {
        const listing = listings.get(candidate.listingPublicId)
        // Seules les annonces publiées sont mesurées côté client.
        if (!listing || listing.deleted || listing.status !== "PUBLISHED") {
          this.ignore(result, source, "listing_unavailable", receivedAt)
          continue
        }
        // Un gestionnaire ne gonfle pas les statistiques de sa propre annonce.
        if (managed.has(listing.propertyId)) {
          this.ignore(result, source, "own_listing", receivedAt)
          continue
        }
        listingId = listing.id
      }
      rows.push({
        eventId: candidate.eventId,
        name: candidate.name,
        schemaVersion: candidate.version,
        source,
        basis: "CONSENT",
        policyVersion: context.consent.policyVersion,
        occurredAt: candidate.occurredAt,
        receivedAt,
        userId: actor?.userId ?? null,
        // Pas de rapprochement entre l'historique anonyme et le compte.
        anonymousId: actor ? null : (context.anonymousId ?? null),
        sessionId: context.sessionId ?? null,
        listingId,
        properties: candidate.properties as Prisma.InputJsonObject,
        requestId: client.requestId,
        appVersion: context.appVersion ?? null,
      })
    }

    const inserted = await this.repository.insertEvents(rows)
    result.accepted = inserted.size
    result.duplicates = rows.length - inserted.size
    this.stats.record(source, "accepted", "", result.accepted, receivedAt)
    this.stats.record(source, "duplicate", "", result.duplicates, receivedAt)
    this.metrics.analytics.batchLatency.observe(performance.now() - started)
    return result
  }

  private ignore(
    result: IngestResult,
    source: AnalyticsSource,
    reason: IgnoreReason,
    at: Date,
  ): void {
    result.ignored++
    this.stats.record(source, "ignored", reason, 1, at)
  }
}
