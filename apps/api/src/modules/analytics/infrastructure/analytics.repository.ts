import { Injectable } from "@nestjs/common"

import { DatabaseService, type Db } from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import type {
  AnalyticsBasis,
  AnalyticsConsentStatus,
  AnalyticsSource,
  ListingStatus,
} from "../../../generated/prisma/enums"
import { MANAGING_RELATIONS } from "../../property"

export interface EventRow {
  eventId: string
  name: string
  schemaVersion: number
  source: AnalyticsSource
  basis: AnalyticsBasis
  policyVersion: string | null
  occurredAt: Date
  receivedAt: Date
  userId: bigint | null
  anonymousId: string | null
  sessionId: string | null
  listingId: bigint | null
  properties: Prisma.InputJsonObject
  requestId: string | null
  appVersion: string | null
}

export interface ListingRef {
  id: bigint
  propertyId: bigint
  status: ListingStatus
  deleted: boolean
}

export interface StatEntry {
  /** Jour UTC `YYYY-MM-DD` (pas de conversion par le fuseau de la session). */
  day: string
  source: AnalyticsSource
  outcome: "accepted" | "duplicate" | "rejected" | "ignored"
  reason: string
  count: number
}

/** Accès aux tables `analytics_*`. Aucune lecture ne renvoie de propriété brute hors module. */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.transaction(run)
  }

  /** Insère sans doublon ; renvoie les `event_id` réellement insérés. */
  async insertEvents(rows: EventRow[], db: Db = this.client) {
    if (rows.length === 0) return new Set<string>()
    const inserted = await db.analyticsEvent.createManyAndReturn({
      data: rows,
      skipDuplicates: true,
      select: { eventId: true },
    })
    return new Set(inserted.map((row) => row.eventId))
  }

  async listingsByPublicId(
    publicIds: readonly string[],
  ): Promise<Map<string, ListingRef>> {
    if (publicIds.length === 0) return new Map()
    const rows = await this.client.listing.findMany({
      where: { publicId: { in: [...new Set(publicIds)] } },
      select: {
        id: true,
        publicId: true,
        propertyId: true,
        status: true,
        deletedAt: true,
      },
    })
    return new Map(
      rows.map((row) => [
        row.publicId,
        {
          id: row.id,
          propertyId: row.propertyId,
          status: row.status,
          deleted: row.deletedAt !== null,
        },
      ]),
    )
  }

  /** Biens, parmi ceux donnés, que l'utilisateur gère actuellement. */
  async managedPropertyIds(
    userId: bigint,
    propertyIds: readonly bigint[],
  ): Promise<Set<bigint>> {
    if (propertyIds.length === 0) return new Set()
    const rows = await this.client.propertyOwnership.findMany({
      where: {
        ownerId: userId,
        isCurrent: true,
        ownershipType: { in: [...MANAGING_RELATIONS] },
        propertyId: { in: [...new Set(propertyIds)] },
      },
      select: { propertyId: true },
    })
    return new Set(rows.map((row) => row.propertyId))
  }

  findConsent(userId: bigint, db: Db = this.client) {
    return db.analyticsConsent.findUnique({
      where: { userId },
      select: {
        status: true,
        policyVersion: true,
        source: true,
        updatedAt: true,
      },
    })
  }

  upsertConsent(
    userId: bigint,
    data: {
      status: AnalyticsConsentStatus
      policyVersion: string
      source: string
    },
    db: Db,
  ) {
    const now = new Date()
    return db.analyticsConsent.upsert({
      where: { userId },
      create: { userId, ...data, createdAt: now, updatedAt: now },
      update: { ...data, updatedAt: now },
      select: { status: true, policyVersion: true, updatedAt: true },
    })
  }

  /** Incréments groupés ; un conflit additionne au compteur existant. */
  async addIngestionStats(entries: readonly StatEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.client.$executeRaw`
        INSERT INTO analytics_ingestion_stats (day, source, outcome, reason, count)
        VALUES (${entry.day}::date, ${entry.source}::analytics_source,
                ${entry.outcome}, ${entry.reason}, ${entry.count})
        ON CONFLICT (day, source, outcome, reason)
        DO UPDATE SET count = analytics_ingestion_stats.count + EXCLUDED.count
      `
    }
  }
}
