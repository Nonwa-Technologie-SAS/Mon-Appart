import { Injectable } from "@nestjs/common"
import type {
  RecommendationContext,
  RecommendationFeedbackType,
  RecommendationReasonCode,
} from "@mon-appart/types"

import { DatabaseService } from "../../../database/database.service"
import type { ScoreComponents } from "../domain/recommendation-input"

export interface ServedRecommendation {
  listingId: bigint
  propertyId: bigint
  rank: number
  /** 0..1 */
  score: number
  reasons: RecommendationReasonCode[]
  components: ScoreComponents
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
export class RecommendationRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Enregistre la page servie (une requête, idempotent par utilisateur,
   * annonce, contexte et version) et renvoie les identifiants publics par
   * annonce. Calculé ≠ affiché : l'affichage est un retour `DISPLAYED`.
   */
  async saveServed(
    userId: bigint,
    context: RecommendationContext,
    algorithmVersion: string,
    items: readonly ServedRecommendation[],
    generatedAt: Date,
    expiresAt: Date,
  ): Promise<Map<bigint, string>> {
    if (items.length === 0) return new Map()
    const rows = await this.db.client.$queryRaw<
      Array<{ listing_id: bigint; public_id: string }>
    >`
      INSERT INTO recommendations
        (user_id, property_id, listing_id, context, rank, score, reason,
         algorithm_version, generated_at, expires_at)
      SELECT ${userId}, x.property_id, x.listing_id, ${context}::recommendation_context,
             x.rank, x.score, x.reason, ${algorithmVersion},
             ${generatedAt}::timestamptz, ${expiresAt}::timestamptz
        FROM unnest(
          ${items.map((item) => item.propertyId)}::bigint[],
          ${items.map((item) => item.listingId)}::bigint[],
          ${items.map((item) => item.rank)}::smallint[],
          ${items.map((item) => item.score)}::float8[],
          ${items.map((item) =>
            JSON.stringify({
              codes: item.reasons,
              components: item.components,
            }),
          )}::jsonb[]
        ) AS x(property_id, listing_id, rank, score, reason)
      ON CONFLICT (user_id, listing_id, context, algorithm_version) DO UPDATE
        SET rank = EXCLUDED.rank,
            score = EXCLUDED.score,
            reason = EXCLUDED.reason,
            generated_at = EXCLUDED.generated_at,
            expires_at = EXCLUDED.expires_at
      RETURNING listing_id, public_id::text AS public_id
    `
    return new Map(rows.map((row) => [row.listing_id, row.public_id]))
  }

  /** Recommandation de cet utilisateur uniquement : une autre est introuvable. */
  async findOwned(
    publicId: string,
    userId: bigint,
  ): Promise<{ id: bigint } | null> {
    if (!UUID.test(publicId)) return null
    return this.db.client.recommendation.findFirst({
      where: { publicId, userId },
      select: { id: true },
    })
  }

  /** Idempotent : `true` si le retour est nouveau. */
  async addFeedback(
    recommendationId: bigint,
    type: RecommendationFeedbackType,
  ): Promise<boolean> {
    const inserted = await this.db.client.$executeRaw`
      INSERT INTO recommendation_feedback (recommendation_id, type)
      VALUES (${recommendationId}, ${type}::recommendation_feedback_type)
      ON CONFLICT (recommendation_id, type) DO NOTHING
    `
    return inserted > 0
  }
}

export const isUuid = (value: string): boolean => UUID.test(value)
