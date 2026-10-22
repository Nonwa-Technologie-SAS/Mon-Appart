import { Injectable } from "@nestjs/common"
import type { TrafficSource } from "../../../generated/prisma/client"

import { DatabaseService } from "../../../database/database.service"

export interface PublishedListingRef {
  listingId: bigint
  listingPublicId: string
  propertyId: bigint
  propertyPublicId: string
}

export interface FavoriteRow {
  listingPublicId: string
  propertyPublicId: string
  title: string
  createdAt: Date
}

/**
 * Favoris et consultations — tables lues par le profil de recommandation.
 */
@Injectable()
export class InteractionRepository {
  constructor(private readonly db: DatabaseService) {}

  async findPublishedListing(
    listingPublicId: string,
  ): Promise<PublishedListingRef | null> {
    const rows = await this.db.client.$queryRaw<
      Array<{
        listing_id: bigint
        listing_public_id: string
        property_id: bigint
        property_public_id: string
      }>
    >`
      SELECT l.id AS listing_id,
             l.public_id::text AS listing_public_id,
             p.id AS property_id,
             p.public_id::text AS property_public_id
        FROM listings l
        JOIN properties p ON p.id = l.property_id
       WHERE l.public_id = ${listingPublicId}::uuid
         AND l.deleted_at IS NULL
         AND l.status = 'PUBLISHED'
         AND (l.expires_at IS NULL OR l.expires_at > NOW())
         AND p.deleted_at IS NULL
         AND p.status = 'ACTIVE'
       LIMIT 1
    `
    const row = rows[0]
    if (!row) return null
    return {
      listingId: row.listing_id,
      listingPublicId: row.listing_public_id,
      propertyId: row.property_id,
      propertyPublicId: row.property_public_id,
    }
  }

  /** Idempotent : true si une ligne a été créée. */
  async addFavorite(userId: bigint, propertyId: bigint): Promise<boolean> {
    const result = await this.db.client.$executeRaw`
      INSERT INTO favorites (user_id, property_id)
      VALUES (${userId}, ${propertyId})
      ON CONFLICT (user_id, property_id) DO NOTHING
    `
    return result > 0
  }

  /** Idempotent : true si une ligne a été supprimée. */
  async removeFavorite(userId: bigint, propertyId: bigint): Promise<boolean> {
    const result = await this.db.client.$executeRaw`
      DELETE FROM favorites
       WHERE user_id = ${userId} AND property_id = ${propertyId}
    `
    return result > 0
  }

  async listFavorites(
    userId: bigint,
    limit: number,
  ): Promise<FavoriteRow[]> {
    return this.db.client.$queryRaw<FavoriteRow[]>`
      SELECT l.public_id::text AS "listingPublicId",
             p.public_id::text AS "propertyPublicId",
             p.title,
             f.created_at AS "createdAt"
        FROM favorites f
        JOIN properties p ON p.id = f.property_id
        JOIN LATERAL (
          SELECT l.public_id
            FROM listings l
           WHERE l.property_id = p.id
             AND l.deleted_at IS NULL
             AND l.status = 'PUBLISHED'
             AND (l.expires_at IS NULL OR l.expires_at > NOW())
           ORDER BY l.published_at DESC NULLS LAST, l.id DESC
           LIMIT 1
        ) l ON true
       WHERE f.user_id = ${userId}
         AND p.deleted_at IS NULL
       ORDER BY f.created_at DESC
       LIMIT ${limit}
    `
  }

  async isFavorite(userId: bigint, propertyId: bigint): Promise<boolean> {
    const rows = await this.db.client.$queryRaw<Array<{ ok: number }>>`
      SELECT 1 AS ok FROM favorites
       WHERE user_id = ${userId} AND property_id = ${propertyId}
       LIMIT 1
    `
    return rows.length > 0
  }

  /**
   * Enregistre une consultation. Pas d’idempotence stricte (plusieurs vues
   * légitimes) ; le client doit dédupliquer via eventId analytics côté nav.
   */
  async recordView(input: {
    userId: bigint | null
    propertyId: bigint
    sessionId: string | null
    source: TrafficSource
    durationMs: number | null
  }): Promise<void> {
    await this.db.client.$executeRaw`
      INSERT INTO property_views (user_id, property_id, session_id, source, duration_ms)
      VALUES (
        ${input.userId},
        ${input.propertyId},
        ${input.sessionId},
        ${input.source}::traffic_source,
        ${input.durationMs}
      )
    `
  }
}
