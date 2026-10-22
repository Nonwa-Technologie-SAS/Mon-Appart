import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { safeErrorMessage } from "../../../common/http/safe-error"
import type { VerificationStatus } from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import { MEDIA_DOCUMENT_ACCESS, type MediaDocumentAccess } from "../../media"
import {
  TrustAuditAction,
  TrustEvent,
  VERIFICATION_ENTITY,
  VerificationAction,
} from "../domain/trust-events"
import { verificationNotice } from "../domain/trust-notifications"
import { TrustRepository } from "../infrastructure/trust.repository"
import { TrustConfig } from "../trust.config"
import { TrustActivity } from "./trust-activity"

/** Dossiers clos dont les pièces n'ont plus à être conservées après la rétention. */
const DECIDED_STATUSES: VerificationStatus[] = [
  "VERIFIED",
  "REJECTED",
  "WITHDRAWN",
  "REVOKED",
  "EXPIRED",
]
const BATCH = 100

/**
 * Tâches périodiques : expiration des vérifications échues et minimisation
 * des pièces (retrait des fichiers après la durée de rétention ; la décision
 * et son historique restent). Idempotentes et sûres en multi-instance : chaque
 * dossier est verrouillé et son état relu avant écriture.
 */
@Injectable()
export class TrustMaintenanceService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger("TrustMaintenance")
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null

  constructor(
    private readonly trust: TrustRepository,
    private readonly notifications: NotificationService,
    private readonly activity: TrustActivity,
    private readonly config: TrustConfig,
    @Inject(MEDIA_DOCUMENT_ACCESS) private readonly media: MediaDocumentAccess,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.maintenanceIntervalMs <= 0) return
    this.timer = setInterval(() => {
      if (this.running) return
      this.running = this.run()
        .catch((error: unknown) =>
          this.logger.error(
            JSON.stringify({
              action: "trust.maintenance_failed",
              error: safeErrorMessage(error),
            }),
          ),
        )
        .finally(() => {
          this.running = null
        })
    }, this.config.maintenanceIntervalMs)
    this.timer.unref()
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.running?.catch(() => undefined)
  }

  async run(now = new Date()): Promise<{ expired: number; retired: number }> {
    const expired = await this.expireDue(now)
    const retired = await this.retireDocuments(now)
    if (expired || retired) {
      this.activity.log("trust.maintenance", null, { expired, retired })
    }
    return { expired, retired }
  }

  async expireDue(now = new Date()): Promise<number> {
    let count = 0
    for (;;) {
      const due = await this.trust.client.verification.findMany({
        where: { status: "VERIFIED", expiresAt: { lte: now } },
        orderBy: { id: "asc" },
        take: BATCH,
        select: { publicId: true },
      })
      if (due.length === 0) break
      for (const { publicId } of due) {
        if (await this.expireOne(publicId, now)) count++
      }
      if (due.length < BATCH) break
    }
    return count
  }

  async retireDocuments(now = new Date()): Promise<number> {
    const before = new Date(
      now.getTime() - this.config.documentRetentionDays * 86_400_000,
    )
    let count = 0
    for (;;) {
      const due = await this.trust.client.verification.findMany({
        where: {
          status: { in: DECIDED_STATUSES },
          decidedAt: { lte: before },
          documents: { some: { status: { not: "REMOVED" } } },
        },
        orderBy: { id: "asc" },
        take: BATCH,
        select: { publicId: true },
      })
      if (due.length === 0) break
      for (const { publicId } of due) {
        count += await this.retireOne(publicId, before)
      }
      if (due.length < BATCH) break
    }
    return count
  }

  private async expireOne(publicId: string, now: Date): Promise<boolean> {
    const expired = await this.trust.transaction(async (tx) => {
      const row = await this.trust.lockVerification(publicId, tx)
      if (
        !row ||
        row.status !== "VERIFIED" ||
        !row.expiresAt ||
        row.expiresAt > now
      ) {
        return null
      }
      await tx.verification.update({
        where: { id: row.id },
        data: { status: "EXPIRED", reasonCode: "EXPIRED" },
      })
      await this.trust.addEvent(
        {
          verificationId: row.id,
          action: VerificationAction.EXPIRED,
          fromStatus: "VERIFIED",
          toStatus: "EXPIRED",
          actorKind: "SYSTEM",
          reasonCode: "EXPIRED",
        },
        tx,
      )
      await this.activity.audit(
        {
          action: TrustAuditAction.VERIFICATION_EXPIRED,
          actorId: null,
          entityType: VERIFICATION_ENTITY,
          entityId: row.publicId,
          oldValues: { status: "VERIFIED" },
          newValues: { status: "EXPIRED" },
        },
        null,
        tx,
      )
      await this.notifications.notify(
        row.userId,
        {
          type: "VERIFICATION",
          ...verificationNotice.expired(row.type),
          data: { verificationId: row.publicId, status: "EXPIRED" },
        },
        tx,
      )
      return row
    })
    if (!expired) return false
    this.activity.emit(TrustEvent.VERIFICATION_EXPIRED, expired.publicId, {
      verificationId: expired.publicId,
      type: expired.type,
      status: "EXPIRED",
    })
    this.activity.emit(TrustEvent.TRUST_CHANGED, expired.user.publicId, {
      userId: expired.user.publicId,
      propertyId: expired.property?.publicId ?? null,
      listingId: expired.listing?.publicId ?? null,
    })
    return true
  }

  private async retireOne(publicId: string, before: Date): Promise<number> {
    const mediaIds = await this.trust.transaction(async (tx) => {
      const row = await this.trust.lockVerification(publicId, tx)
      if (
        !row ||
        !DECIDED_STATUSES.includes(row.status) ||
        !row.decidedAt ||
        row.decidedAt > before
      ) {
        return []
      }
      const live = row.documents.filter((doc) => doc.status !== "REMOVED")
      if (live.length === 0) return []
      const now = new Date()
      await tx.verificationDocument.updateMany({
        where: { id: { in: live.map((doc) => doc.id) } },
        data: { status: "REMOVED", removedAt: now },
      })
      await this.trust.addEvent(
        {
          verificationId: row.id,
          action: VerificationAction.DOCUMENTS_RETIRED,
          fromStatus: row.status,
          toStatus: row.status,
          actorKind: "SYSTEM",
        },
        tx,
      )
      await this.activity.audit(
        {
          action: TrustAuditAction.VERIFICATION_DOCUMENT_REMOVED,
          actorId: null,
          entityType: VERIFICATION_ENTITY,
          entityId: row.publicId,
          newValues: { retention: true, documents: live.length },
        },
        null,
        tx,
      )
      return live.map((doc) => doc.media.id)
    })
    for (const mediaId of mediaIds) {
      await this.media.retire(mediaId, { immediate: true })
    }
    return mediaIds.length
  }
}
