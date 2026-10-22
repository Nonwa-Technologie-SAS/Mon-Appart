import { Injectable, Logger } from "@nestjs/common"

import type { DomainEvent } from "../../../common/events/domain-event"
import { OnEvents } from "../../../common/events/on-events.decorator"
import { safeErrorMessage } from "../../../common/http/safe-error"
import type { Actor, ClientContext } from "../../identity"
import { holdsClaimedRelation, type VerificationFact } from "../domain/badges"
import { trustError } from "../domain/trust-errors"
import {
  TRUST_SCORE_ENTITY,
  TrustAuditAction,
  TrustEvent,
} from "../domain/trust-events"
import {
  computeTrustScore,
  TRUST_SCORE_VERSION,
  type ScoreFactor,
  type TrustScoreFacts,
} from "../domain/trust-score"
import { isValidVerification } from "../domain/verification-status"
import { TrustRepository } from "../infrastructure/trust.repository"
import { TrustActivity } from "./trust-activity"

export interface TrustScoreView {
  userId: string
  /** Nul tant que les données sont insuffisantes : rien n'est conclu. */
  score: number | null
  isComplete: boolean
  identityScore: number
  propertyScore: number
  behaviorScore: number
  transactionScore: number
  algorithmVersion: string
  factors: ScoreFactor[]
  computedAt: Date
}

interface TrustChangedPayload {
  userId: string
}

/**
 * Score interne d'aide à la modération, jamais affiché publiquement ni
 * utilisé pour décider seul. Recalculé à chaque changement de confiance.
 */
@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger("TrustScore")

  constructor(
    private readonly trust: TrustRepository,
    private readonly activity: TrustActivity,
  ) {}

  async facts(userId: bigint, now = new Date()): Promise<TrustScoreFacts> {
    const [user, verifications, confirmedReports] = await Promise.all([
      this.trust.findUserById(userId),
      this.trust.userFacts(userId),
      this.trust.client.report.count({
        where: {
          status: "CONFIRMED",
          OR: [{ targetUserId: userId }, { listing: { createdById: userId } }],
        },
      }),
    ])
    const valid = (accept: (fact: VerificationFact) => boolean) =>
      verifications.some(
        (fact) => accept(fact) && isValidVerification(fact, now),
      )
    const rights = verifications.filter(
      (fact) =>
        (fact.type === "PROPERTY_OWNERSHIP" ||
          fact.type === "OWNER_AUTHORIZATION") &&
        fact.propertyId !== null &&
        isValidVerification(fact, now),
    )
    let publicationRightVerified = false
    for (const fact of rights) {
      const relations = await this.trust.currentRelations(fact.propertyId!)
      if (holdsClaimedRelation(fact, relations)) {
        publicationRightVerified = true
        break
      }
    }
    return {
      phoneVerified: user?.phoneVerifiedAt != null,
      emailVerified: user?.emailVerifiedAt != null,
      identityVerified: valid((fact) => fact.type === "IDENTITY"),
      agencyVerified: valid((fact) => fact.type === "AGENCY"),
      publicationRightVerified,
      propertyDocumentsVerified: valid(
        (fact) => fact.type === "PROPERTY_DOCUMENT",
      ),
      // Approuvée un jour : VERIFIED, puis éventuellement EXPIRED ou REVOKED.
      everReviewedApproved: verifications.some(
        (fact) =>
          fact.type !== "PHONE" &&
          fact.type !== "EMAIL" &&
          fact.verifiedAt !== null,
      ),
      confirmedReports,
      revocations: verifications.filter((fact) => fact.status === "REVOKED")
        .length,
    }
  }

  async recompute(userId: bigint): Promise<void> {
    const result = computeTrustScore(await this.facts(userId))
    const data = {
      score: result.score,
      identityScore: result.identityScore,
      propertyScore: result.propertyScore,
      behaviorScore: result.behaviorScore,
      transactionScore: result.transactionScore,
      algorithmVersion: TRUST_SCORE_VERSION,
      factors: { items: result.factors.map((factor) => ({ ...factor })) },
      isComplete: result.isComplete,
      computedAt: new Date(),
    }
    await this.trust.client.trustScore.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
  }

  /** Consultation réservée (`trust_score:read`) et auditée. */
  async get(
    actor: Actor,
    userPublicId: string,
    client: ClientContext,
  ): Promise<TrustScoreView> {
    const user = await this.trust.findUserByPublicId(userPublicId)
    if (!user) throw trustError("USER_NOT_FOUND")
    if (user.id === actor.userId) throw trustError("SELF_REVIEW_FORBIDDEN")
    let row = await this.trust.client.trustScore.findUnique({
      where: { userId: user.id },
    })
    if (!row || row.algorithmVersion !== TRUST_SCORE_VERSION) {
      await this.recompute(user.id)
      row = await this.trust.client.trustScore.findUnique({
        where: { userId: user.id },
      })
    }
    if (!row) throw trustError("USER_NOT_FOUND")
    await this.activity.audit(
      {
        action: TrustAuditAction.SCORE_VIEWED,
        actorId: actor.userId,
        entityType: TRUST_SCORE_ENTITY,
        entityId: user.publicId,
      },
      client,
      this.trust.client,
    )
    const factors = (row.factors as { items?: ScoreFactor[] }).items ?? []
    return {
      userId: user.publicId,
      score: row.score === null ? null : Number(row.score),
      isComplete: row.isComplete,
      identityScore: Number(row.identityScore),
      propertyScore: Number(row.propertyScore),
      behaviorScore: Number(row.behaviorScore),
      transactionScore: Number(row.transactionScore),
      algorithmVersion: row.algorithmVersion,
      factors,
      computedAt: row.computedAt,
    }
  }

  @OnEvents([TrustEvent.TRUST_CHANGED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onTrustChanged(event: DomainEvent<TrustChangedPayload>): Promise<void> {
    try {
      const user = await this.trust.findUserByPublicId(event.payload.userId)
      if (user) await this.recompute(user.id)
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          action: "trust.score_recompute_failed",
          error: safeErrorMessage(error),
        }),
      )
    }
  }
}
