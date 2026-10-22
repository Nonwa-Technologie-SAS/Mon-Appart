import { Inject, Injectable } from "@nestjs/common"
import { decodeCursor, encodeCursor } from "@mon-appart/validation"

import type { Tx } from "../../../database/database.service"
import type {
  VerificationPriority,
  VerificationStatus,
  VerificationType,
} from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import { can, type Actor, type ClientContext } from "../../identity"
import {
  MEDIA_DOCUMENT_ACCESS,
  type DownloadLink,
  type MediaDocumentAccess,
} from "../../media"
import { holdsClaimedRelation } from "../domain/badges"
import {
  INFORMATION_REASON_CODES,
  REJECTION_REASON_CODES,
  REVOCATION_REASON_CODES,
} from "../domain/reason-codes"
import {
  assertCanReview,
  assertIndependentReviewer,
  type ReviewAction,
} from "../domain/review-policy"
import { trustError } from "../domain/trust-errors"
import {
  TrustAuditAction,
  TrustEvent,
  VERIFICATION_ENTITY,
  VerificationAction,
} from "../domain/trust-events"
import { verificationNotice } from "../domain/trust-notifications"
import {
  documentRequirement,
  expiryFor,
  isRequestableType,
  missingDocumentGroups,
  REQUIRES_VERIFIED_IDENTITY,
} from "../domain/verification-requirements"
import {
  canTransitionVerification,
  REVIEWABLE_STATUSES,
} from "../domain/verification-status"
import { hasValidIdentity } from "../infrastructure/publication-facts"
import {
  TrustRepository,
  verificationSelect,
  type VerificationRow,
} from "../infrastructure/trust.repository"
import { TrustConfig } from "../trust.config"
import { TrustActivity } from "./trust-activity"
import {
  readyDocumentTypes,
  reviewQueueItem,
  reviewVerificationView,
  type ReviewQueueItemView,
  type ReviewVerificationView,
} from "./verification-views"

export interface ReviewQueueFilters {
  status?: VerificationStatus
  type?: VerificationType
  priority?: VerificationPriority
  assignedToMe?: boolean
  cursor?: string
  limit?: number
}

export interface DecisionInput {
  reasonCode?: string
  /** Message montré au déclarant (pièce attendue...). */
  message?: string
  /** Note réservée aux relecteurs ; jamais notifiée ni exposée au déclarant. */
  internalNote?: string
}

const QUEUE_STATUSES: VerificationStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "NEEDS_MORE_INFORMATION",
]
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Instruction et décisions. Instruire (affecter, demander un complément,
 * escalader) n'autorise pas à décider ; décider sur pièces exige de pouvoir
 * les consulter. Nul ne relit son propre dossier ni celui d'un bien auquel il
 * est rattaché. Toute consultation et toute décision sont auditées.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly notifications: NotificationService,
    private readonly activity: TrustActivity,
    private readonly config: TrustConfig,
    @Inject(MEDIA_DOCUMENT_ACCESS) private readonly media: MediaDocumentAccess,
  ) {}

  async queue(
    actor: Actor,
    filters: ReviewQueueFilters,
  ): Promise<{ items: ReviewQueueItemView[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100)
    let pivot: { id: bigint; submittedAt: Date | null } | null = null
    if (filters.cursor) {
      const payload = decodeCursor(filters.cursor)
      if (!payload || !UUID_PATTERN.test(payload.id)) {
        throw trustError("INVALID_CURSOR")
      }
      pivot = await this.trust.client.verification.findUnique({
        where: { publicId: payload.id },
        select: { id: true, submittedAt: true },
      })
      if (!pivot?.submittedAt) return { items: [], nextCursor: null }
    }
    const rows = await this.trust.client.verification.findMany({
      where: {
        status: filters.status
          ? filters.status === "DRAFT"
            ? { in: [] }
            : filters.status
          : { in: QUEUE_STATUSES },
        submittedAt: { not: null },
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.assignedToMe ? { assignedToId: actor.userId } : {}),
        ...(pivot?.submittedAt
          ? {
              OR: [
                { submittedAt: { gt: pivot.submittedAt } },
                { submittedAt: pivot.submittedAt, id: { gt: pivot.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: verificationSelect,
    })
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      items: page.map(reviewQueueItem),
      nextCursor:
        rows.length > limit && last?.submittedAt
          ? encodeCursor({
              id: last.publicId,
              createdAt: last.submittedAt.toISOString(),
            })
          : null,
    }
  }

  async detail(
    actor: Actor,
    publicId: string,
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    const row = await this.load(publicId)
    assertCanReview(actor, "VIEW", false)
    await this.assertIndependent(actor.userId, row)
    await this.activity.audit(
      {
        action: TrustAuditAction.VERIFICATION_VIEWED,
        actorId: actor.userId,
        entityType: VERIFICATION_ENTITY,
        entityId: row.publicId,
        newValues: { status: row.status },
      },
      client,
      this.trust.client,
    )
    return this.reviewView(row)
  }

  /**
   * Lien de lecture court d'une pièce : permission dédiée, indépendance,
   * double audit (Trust ici, Media dans `createReviewLink`).
   */
  async documentLink(
    actor: Actor,
    publicId: string,
    documentId: string,
    client: ClientContext,
  ): Promise<DownloadLink> {
    const row = await this.load(publicId)
    assertCanReview(actor, "VIEW", false)
    if (!can(actor, "verification:documents")) {
      throw trustError("DECISION_PERMISSION_REQUIRED", "verification:documents")
    }
    await this.assertIndependent(actor.userId, row)
    const doc = row.documents.find(
      (entry) => entry.publicId === documentId && entry.status !== "REMOVED",
    )
    if (!doc) throw trustError("VERIFICATION_DOCUMENT_NOT_FOUND")
    const link = await this.media.createReviewLink(doc.media.publicId, {
      userId: actor.userId,
      requestId: client.requestId,
    })
    if (!link) throw trustError("DOCUMENTS_NOT_READY")
    await this.activity.audit(
      {
        action: TrustAuditAction.VERIFICATION_DOCUMENT_ACCESSED,
        actorId: actor.userId,
        entityType: VERIFICATION_ENTITY,
        entityId: row.publicId,
        newValues: { documentId, documentType: doc.documentType },
      },
      client,
      this.trust.client,
    )
    return link
  }

  /** Prise en charge (par défaut par soi-même) : PENDING → IN_REVIEW. */
  async assign(
    actor: Actor,
    publicId: string,
    input: { assigneeId?: string; internalNote?: string },
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    let assigneeId = actor.userId
    let assigneePublicId = actor.publicId
    if (input.assigneeId && input.assigneeId !== actor.publicId) {
      const assignee = await this.trust.findUserByPublicId(input.assigneeId)
      if (!assignee || !(await this.trust.canInstruct(assignee.id))) {
        throw trustError("ASSIGNEE_INVALID")
      }
      assigneeId = assignee.id
      assigneePublicId = assignee.publicId
    }
    await this.decide(actor, publicId, "ASSIGN", client, async (row, tx) => {
      if (!REVIEWABLE_STATUSES.includes(row.status)) {
        throw trustError("INVALID_VERIFICATION_TRANSITION")
      }
      if (assigneeId !== actor.userId) {
        await this.assertIndependent(assigneeId, row, tx)
      }
      await tx.verification.update({
        where: { id: row.id },
        data: { status: "IN_REVIEW", assignedToId: assigneeId },
      })
      return {
        action: VerificationAction.ASSIGNED,
        audit: TrustAuditAction.VERIFICATION_ASSIGNED,
        event: TrustEvent.VERIFICATION_ASSIGNED,
        toStatus: "IN_REVIEW",
        internalNote: input.internalNote,
        audited: { assignedTo: assigneePublicId },
      }
    })
    return this.reviewView(await this.load(publicId))
  }

  async requestInformation(
    actor: Actor,
    publicId: string,
    input: DecisionInput,
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    const reasonCode = assertReason(input.reasonCode, INFORMATION_REASON_CODES)
    await this.decide(
      actor,
      publicId,
      "REQUEST_INFORMATION",
      client,
      async (row, tx) => {
        transition(row.status, "NEEDS_MORE_INFORMATION")
        await tx.verification.update({
          where: { id: row.id },
          data: { status: "NEEDS_MORE_INFORMATION", reasonCode },
        })
        await this.notifications.notify(
          row.userId,
          {
            type: "VERIFICATION",
            ...verificationNotice.informationRequested(
              row.type,
              reasonCode,
              clean(input.message),
            ),
            data: {
              verificationId: row.publicId,
              status: "NEEDS_MORE_INFORMATION",
              reasonCode,
            },
          },
          tx,
        )
        return {
          action: VerificationAction.INFORMATION_REQUESTED,
          audit: TrustAuditAction.VERIFICATION_INFORMATION_REQUESTED,
          event: TrustEvent.VERIFICATION_INFORMATION_REQUESTED,
          toStatus: "NEEDS_MORE_INFORMATION",
          reasonCode,
          userMessage: clean(input.message),
          internalNote: input.internalNote,
        }
      },
    )
    return this.reviewView(await this.load(publicId))
  }

  /**
   * Approbation : seule voie vers VERIFIED. Les pièces exigées doivent être
   * présentes et prêtes, le prérequis d'identité valide, et le rattachement
   * revendiqué toujours courant au moment de la décision.
   */
  async approve(
    actor: Actor,
    publicId: string,
    input: DecisionInput,
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    await this.decide(actor, publicId, "APPROVE", client, async (row, tx) => {
      transition(row.status, "VERIFIED")
      if (!isRequestableType(row.type)) {
        throw trustError("VERIFICATION_TYPE_NOT_SUPPORTED")
      }
      const now = new Date()
      const requirement = documentRequirement(
        row.type,
        row.property?.propertyType.category ?? null,
      )
      if (missingDocumentGroups(requirement, readyDocumentTypes(row)).length) {
        throw trustError("DOCUMENTS_INCOMPLETE")
      }
      if (
        REQUIRES_VERIFIED_IDENTITY.includes(row.type) &&
        !(await hasValidIdentity(tx, row.userId, now))
      ) {
        throw trustError("IDENTITY_VERIFICATION_REQUIRED")
      }
      if (row.claimedRelation && row.propertyId !== null) {
        const relations = await this.trust.currentRelations(row.propertyId, tx)
        if (!holdsClaimedRelation(row, relations)) {
          throw trustError(
            "CLAIMED_RELATION_INVALID",
            "rattachement non courant",
          )
        }
      }
      const expiresAt = expiryFor(row.type, now, this.config.validity)
      await tx.verification.update({
        where: { id: row.id },
        data: {
          status: "VERIFIED",
          reasonCode: null,
          rejectionReason: null,
          decidedAt: now,
          verifiedAt: now,
          verifiedById: actor.userId,
          expiresAt,
        },
      })
      await tx.verificationDocument.updateMany({
        where: { verificationId: row.id, status: "ATTACHED" },
        data: { status: "ACCEPTED", reviewedAt: now },
      })
      await this.notifications.notify(
        row.userId,
        {
          type: "VERIFICATION",
          ...verificationNotice.approved(row.type, expiresAt),
          data: { verificationId: row.publicId, status: "VERIFIED" },
        },
        tx,
      )
      return {
        action: VerificationAction.APPROVED,
        audit: TrustAuditAction.VERIFICATION_APPROVED,
        event: TrustEvent.VERIFICATION_APPROVED,
        toStatus: "VERIFIED",
        userMessage: clean(input.message),
        internalNote: input.internalNote,
        audited: { expiresAt: expiresAt?.toISOString() ?? null },
        trustChanged: true,
      }
    })
    return this.reviewView(await this.load(publicId))
  }

  async reject(
    actor: Actor,
    publicId: string,
    input: DecisionInput,
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    const reasonCode = assertReason(input.reasonCode, REJECTION_REASON_CODES)
    await this.decide(actor, publicId, "REJECT", client, async (row, tx) => {
      transition(row.status, "REJECTED")
      const now = new Date()
      const message = clean(input.message)
      await tx.verification.update({
        where: { id: row.id },
        data: {
          status: "REJECTED",
          reasonCode,
          rejectionReason: message?.slice(0, 500) ?? null,
          decidedAt: now,
        },
      })
      await tx.verificationDocument.updateMany({
        where: { verificationId: row.id, status: "ATTACHED" },
        data: { status: "REJECTED", reviewedAt: now },
      })
      await this.notifications.notify(
        row.userId,
        {
          type: "VERIFICATION",
          ...verificationNotice.rejected(row.type, reasonCode, message),
          data: {
            verificationId: row.publicId,
            status: "REJECTED",
            reasonCode,
          },
        },
        tx,
      )
      return {
        action: VerificationAction.REJECTED,
        audit: TrustAuditAction.VERIFICATION_REJECTED,
        event: TrustEvent.VERIFICATION_REJECTED,
        toStatus: "REJECTED",
        reasonCode,
        userMessage: message,
        internalNote: input.internalNote,
        trustChanged: true,
      }
    })
    return this.reviewView(await this.load(publicId))
  }

  /** Révocation explicite d'une vérification approuvée ; jamais automatique. */
  async revoke(
    actor: Actor,
    publicId: string,
    input: DecisionInput,
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    const reasonCode = assertReason(input.reasonCode, REVOCATION_REASON_CODES)
    await this.decide(actor, publicId, "REVOKE", client, async (row, tx) => {
      transition(row.status, "REVOKED")
      const message = clean(input.message)
      await tx.verification.update({
        where: { id: row.id },
        data: { status: "REVOKED", reasonCode, decidedAt: new Date() },
      })
      await this.notifications.notify(
        row.userId,
        {
          type: "VERIFICATION",
          ...verificationNotice.revoked(row.type, reasonCode, message),
          data: {
            verificationId: row.publicId,
            status: "REVOKED",
            reasonCode,
          },
        },
        tx,
      )
      return {
        action: VerificationAction.REVOKED,
        audit: TrustAuditAction.VERIFICATION_REVOKED,
        event: TrustEvent.VERIFICATION_REVOKED,
        toStatus: "REVOKED",
        reasonCode,
        userMessage: message,
        internalNote: input.internalNote,
        trustChanged: true,
      }
    })
    return this.reviewView(await this.load(publicId))
  }

  /** Priorité haute : demande l'attention d'un agent de confiance. */
  async escalate(
    actor: Actor,
    publicId: string,
    input: { internalNote?: string },
    client: ClientContext,
  ): Promise<ReviewVerificationView> {
    await this.decide(actor, publicId, "ESCALATE", client, async (row, tx) => {
      if (!REVIEWABLE_STATUSES.includes(row.status)) {
        throw trustError("INVALID_VERIFICATION_TRANSITION")
      }
      await tx.verification.update({
        where: { id: row.id },
        data: { priority: "HIGH" },
      })
      return {
        action: VerificationAction.ESCALATED,
        audit: TrustAuditAction.VERIFICATION_ESCALATED,
        event: TrustEvent.VERIFICATION_ESCALATED,
        toStatus: row.status,
        internalNote: input.internalNote,
      }
    })
    return this.reviewView(await this.load(publicId))
  }

  // -------------------------------------------------------------------------

  private async decide(
    actor: Actor,
    publicId: string,
    action: ReviewAction,
    client: ClientContext,
    apply: (
      row: VerificationRow,
      tx: Tx,
    ) => Promise<{
      action: string
      audit: string
      event: string
      toStatus: VerificationStatus
      reasonCode?: string
      userMessage?: string | null
      internalNote?: string
      audited?: Record<string, string | null>
      trustChanged?: boolean
    }>,
  ): Promise<void> {
    const outcome = await this.trust.transaction(async (tx) => {
      const row = await this.trust.lockVerification(publicId, tx)
      if (!row) throw trustError("VERIFICATION_NOT_FOUND")
      assertCanReview(
        actor,
        action,
        row.documents.some((doc) => doc.status !== "REMOVED"),
      )
      await this.assertIndependent(actor.userId, row, tx)
      const result = await apply(row, tx)
      await this.trust.addEvent(
        {
          verificationId: row.id,
          action: result.action,
          fromStatus: row.status,
          toStatus: result.toStatus,
          actorId: actor.userId,
          actorKind: "REVIEWER",
          reasonCode: result.reasonCode ?? null,
          userMessage: result.userMessage ?? null,
          internalNote: clean(result.internalNote),
        },
        tx,
      )
      await this.activity.audit(
        {
          action: result.audit,
          actorId: actor.userId,
          entityType: VERIFICATION_ENTITY,
          entityId: row.publicId,
          oldValues: { status: row.status },
          // Ni note interne, ni message libre : seulement statut et code.
          newValues: {
            status: result.toStatus,
            reasonCode: result.reasonCode ?? null,
            ...result.audited,
          },
        },
        client,
        tx,
      )
      return { row, result }
    })
    const { row, result } = outcome
    this.activity.emit(result.event, row.publicId, {
      verificationId: row.publicId,
      type: row.type,
      status: result.toStatus,
      reasonCode: result.reasonCode ?? null,
    })
    if (result.trustChanged) {
      this.activity.emit(TrustEvent.TRUST_CHANGED, row.user.publicId, {
        userId: row.user.publicId,
        propertyId: row.property?.publicId ?? null,
        listingId: row.listing?.publicId ?? null,
      })
    }
    this.activity.log(result.event, client, {
      verification_id: row.publicId,
      status: result.toStatus,
      reason_code: result.reasonCode ?? null,
    })
  }

  private async load(publicId: string): Promise<VerificationRow> {
    const row = await this.trust.findVerification(publicId)
    // Un brouillon n'est pas soumis : il n'existe pas pour les relecteurs.
    if (!row || row.status === "DRAFT") {
      throw trustError("VERIFICATION_NOT_FOUND")
    }
    return row
  }

  private async assertIndependent(
    reviewerId: bigint,
    row: VerificationRow,
    tx?: Tx,
  ): Promise<void> {
    const linked =
      row.propertyId !== null &&
      (await this.trust.currentRelations(row.propertyId, tx)).has(reviewerId)
    assertIndependentReviewer(reviewerId, {
      userId: row.userId,
      reviewerIsLinkedToProperty: linked,
    })
  }

  private async reviewView(row: VerificationRow) {
    const [events, signals] = await Promise.all([
      this.trust.events(row.id),
      this.trust.client.trustSignal.findMany({
        where: { verificationId: row.id },
        orderBy: { createdAt: "desc" },
        select: {
          publicId: true,
          ruleCode: true,
          severity: true,
          status: true,
          createdAt: true,
        },
      }),
    ])
    return reviewVerificationView(
      row,
      events,
      signals.map((signal) => ({
        id: signal.publicId,
        ruleCode: signal.ruleCode,
        severity: signal.severity,
        status: signal.status,
        createdAt: signal.createdAt,
      })),
    )
  }
}

function transition(from: VerificationStatus, to: VerificationStatus): void {
  if (!canTransitionVerification(from, to)) {
    throw trustError("INVALID_VERIFICATION_TRANSITION")
  }
}

function assertReason(
  code: string | undefined,
  allowed: readonly string[],
): string {
  if (!code || !allowed.includes(code)) {
    throw trustError("REASON_CODE_INVALID", allowed.join(", "))
  }
  return code
}

function clean(value: string | undefined | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
