import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import {
  BEHAVIOR_MODEL_VERSION,
  type BehaviorSignal,
  type BehaviorSignalKind,
} from "../domain/behavior-profile"
import type { BehaviorSignals } from "../domain/recommendation-input"

/** Ce que l'utilisateur a déjà traité : jamais reproposé, ou un peu plus bas. */
export interface UserExclusions {
  /** Favoris, biens ignorés, retours négatifs. */
  propertyIds: bigint[]
  /** Annonces déjà contactées ou visitées. */
  listingIds: bigint[]
  /** Biens consultés : pénalité légère. */
  viewedPropertyIds: Set<bigint>
}

interface SignalRow {
  kind: BehaviorSignalKind
  occurred_at: Date
  property_id: bigint | null
  duration_ms: number | null
  neighborhood_id: number | null
  commune_id: number | null
  property_type_code: string | null
}

/** Retours qui écartent définitivement l'annonce pour cet utilisateur. */
const NEGATIVE_FEEDBACK = Prisma.sql`('NOT_INTERESTED', 'IRRELEVANT', 'WRONG_BUDGET', 'WRONG_LOCATION')`
/** Borne la lecture : les signaux les plus récents suffisent au profil. */
const MAX_SIGNALS = 2_000
const MAX_EXCLUSIONS = 1_000
const VIEW_PENALTY_DAYS = 30

/**
 * Lecture des tables d'interaction existantes. Les tables dédiées (favoris,
 * consultations, demandes, rendez-vous, recherches, retours) font foi ;
 * `user_events` n'apporte que les actions sans table propre (appel, WhatsApp,
 * contact, bien ignoré) pour ne jamais compter deux fois la même action.
 */
@Injectable()
export class BehaviorRepository {
  constructor(private readonly db: DatabaseService) {}

  async exclusions(userId: bigint, asOf: Date): Promise<UserExclusions> {
    const viewedSince = new Date(
      asOf.getTime() - VIEW_PENALTY_DAYS * 86_400_000,
    )
    const rows = await this.db.client.$queryRaw<
      Array<{ kind: "P" | "L" | "V"; id: bigint }>
    >`
      (SELECT 'P' AS kind, f.property_id AS id FROM favorites f
        WHERE f.user_id = ${userId} LIMIT ${MAX_EXCLUSIONS})
      UNION
      (SELECT 'P', r.property_id FROM recommendation_feedback rf
         JOIN recommendations r ON r.id = rf.recommendation_id
        WHERE r.user_id = ${userId} AND rf.type::text IN ${NEGATIVE_FEEDBACK}
        LIMIT ${MAX_EXCLUSIONS})
      UNION
      (SELECT 'P', e.property_id FROM user_events e
        WHERE e.user_id = ${userId} AND e.event_type = 'PROPERTY_IGNORED'
          AND e.property_id IS NOT NULL LIMIT ${MAX_EXCLUSIONS})
      UNION
      (SELECT 'L', i.listing_id FROM inquiries i
        WHERE i.user_id = ${userId} LIMIT ${MAX_EXCLUSIONS})
      UNION
      (SELECT 'L', a.listing_id FROM appointments a
        WHERE a.user_id = ${userId} LIMIT ${MAX_EXCLUSIONS})
      UNION
      (SELECT 'V', v.property_id FROM property_views v
        WHERE v.user_id = ${userId} AND v.created_at >= ${viewedSince}::timestamptz
        LIMIT ${MAX_EXCLUSIONS})
    `
    const result: UserExclusions = {
      propertyIds: [],
      listingIds: [],
      viewedPropertyIds: new Set(),
    }
    for (const row of rows) {
      if (row.kind === "P") result.propertyIds.push(row.id)
      else if (row.kind === "L") result.listingIds.push(row.id)
      else result.viewedPropertyIds.add(row.id)
    }
    result.propertyIds.sort(byBigint)
    result.listingIds.sort(byBigint)
    return result
  }

  /**
   * Signaux de la fenêtre, caractéristiques de la cible jointes en une
   * requête ; équipements chargés ensuite en lot. Les biens publiés par
   * l'utilisateur lui-même sont ignorés.
   */
  async signals(userId: bigint, since: Date): Promise<BehaviorSignal[]> {
    const rows = await this.db.client.$queryRaw<SignalRow[]>`
      WITH raw AS (
        SELECT 'FAVORITE' AS kind, f.created_at AS occurred_at, f.property_id, NULL::int AS duration_ms,
               NULL::int AS neighborhood_id, NULL::int AS property_type_id
          FROM favorites f WHERE f.user_id = ${userId} AND f.created_at >= ${since}::timestamptz
        UNION ALL
        SELECT 'VIEW', v.created_at, v.property_id, v.duration_ms, NULL, NULL
          FROM property_views v WHERE v.user_id = ${userId} AND v.created_at >= ${since}::timestamptz
        UNION ALL
        SELECT 'INQUIRY', i.created_at, i.property_id, NULL, NULL, NULL
          FROM inquiries i WHERE i.user_id = ${userId} AND i.created_at >= ${since}::timestamptz
        UNION ALL
        SELECT 'APPOINTMENT', a.created_at, a.property_id, NULL, NULL, NULL
          FROM appointments a WHERE a.user_id = ${userId} AND a.created_at >= ${since}::timestamptz
        UNION ALL
        SELECT 'INQUIRY', e.occurred_at, e.property_id, NULL, NULL, NULL
          FROM user_events e
         WHERE e.user_id = ${userId} AND e.occurred_at >= ${since}::timestamptz
           AND e.property_id IS NOT NULL
           AND e.event_type IN ('CONTACT_OWNER', 'WHATSAPP_CLICKED', 'PHONE_CLICKED')
        UNION ALL
        SELECT CASE WHEN rf.type = 'INTERESTED' THEN 'RECOMMENDATION_INTERESTED'
                    ELSE 'RECOMMENDATION_CLICKED' END,
               rf.created_at, r.property_id, NULL, NULL, NULL
          FROM recommendation_feedback rf JOIN recommendations r ON r.id = rf.recommendation_id
         WHERE r.user_id = ${userId} AND rf.created_at >= ${since}::timestamptz
           AND rf.type IN ('CLICKED', 'INTERESTED')
        UNION ALL
        SELECT 'SEARCH', s.created_at, NULL, NULL, s.neighborhood_id, s.property_type_id
          FROM searches s WHERE s.user_id = ${userId} AND s.created_at >= ${since}::timestamptz
           AND (s.neighborhood_id IS NOT NULL OR s.property_type_id IS NOT NULL)
      ),
      recent AS (
        SELECT * FROM raw ORDER BY occurred_at DESC LIMIT ${MAX_SIGNALS}
      )
      SELECT recent.kind, recent.occurred_at, recent.property_id, recent.duration_ms,
             COALESCE(p.neighborhood_id, recent.neighborhood_id) AS neighborhood_id,
             n.commune_id,
             pt.code AS property_type_code
        FROM recent
        LEFT JOIN properties p ON p.id = recent.property_id
        LEFT JOIN neighborhoods n ON n.id = COALESCE(p.neighborhood_id, recent.neighborhood_id)
        LEFT JOIN property_types pt ON pt.id = COALESCE(p.property_type_id, recent.property_type_id)
       WHERE recent.property_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM listings own
             WHERE own.property_id = recent.property_id AND own.created_by_id = ${userId}
          )
    `
    const propertyIds = [
      ...new Set(
        rows.flatMap((row) =>
          row.property_id === null ? [] : [row.property_id],
        ),
      ),
    ]
    const amenities = await this.amenitiesOf(propertyIds)
    return rows.map((row) => ({
      kind: row.kind,
      occurredAt: row.occurred_at,
      propertyId: row.property_id,
      durationMs: row.duration_ms,
      neighborhoodId: row.neighborhood_id,
      communeId: row.commune_id,
      propertyTypeCode: row.property_type_code,
      amenityCodes:
        row.property_id === null ? [] : (amenities.get(row.property_id) ?? []),
    }))
  }

  async profile(
    userId: bigint,
  ): Promise<{ row: StoredProfile; updatedAt: Date } | null> {
    const row = await this.db.client.userBehaviorProfile.findUnique({
      where: { userId },
      select: {
        preferredLocations: true,
        preferredPropertyTypes: true,
        preferredAmenities: true,
        modelVersion: true,
        updatedAt: true,
      },
    })
    if (!row || row.modelVersion !== BEHAVIOR_MODEL_VERSION) return null
    return { row, updatedAt: row.updatedAt }
  }

  /** Efface le profil inféré (préférences explicites inchangées). */
  async clearProfile(userId: bigint): Promise<boolean> {
    const result = await this.db.client.userBehaviorProfile.deleteMany({
      where: { userId },
    })
    return result.count > 0
  }

  async saveProfile(userId: bigint, signals: BehaviorSignals): Promise<void> {
    const data = {
      preferredLocations: {
        neighborhoods: signals.neighborhoods,
        communes: signals.communes,
      },
      preferredPropertyTypes: signals.propertyTypes,
      preferredAmenities: signals.amenities,
      modelVersion: BEHAVIOR_MODEL_VERSION,
    }
    await this.db.client.userBehaviorProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data, updatedAt: new Date() },
    })
  }

  private async amenitiesOf(
    propertyIds: bigint[],
  ): Promise<Map<bigint, string[]>> {
    const map = new Map<bigint, string[]>()
    if (propertyIds.length === 0) return map
    const rows = await this.db.client.$queryRaw<
      Array<{ property_id: bigint; code: string }>
    >`
      SELECT pa.property_id, a.code FROM property_amenities pa
        JOIN amenities a ON a.id = pa.amenity_id
       WHERE pa.property_id IN (${Prisma.join(propertyIds)})
       ORDER BY pa.property_id, a.code
    `
    for (const row of rows) {
      const codes = map.get(row.property_id) ?? []
      codes.push(row.code)
      map.set(row.property_id, codes)
    }
    return map
  }
}

export interface StoredProfile {
  preferredLocations: unknown
  preferredPropertyTypes: unknown
  preferredAmenities: unknown
}

const byBigint = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0)
