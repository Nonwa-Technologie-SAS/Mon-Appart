import { Inject, Injectable } from "@nestjs/common"

import type { Tx } from "../../../database/database.service"
import type { Actor, ClientContext } from "../../identity"
import { mediaError } from "../domain/media-errors"
import {
  MEDIA_ENTITY,
  MediaAuditAction,
  MediaEvent,
} from "../domain/media-events"
import { isPrimaryEligible } from "../domain/media-policy"
import {
  MediaRepository,
  type MediaRow,
  type PropertyRef,
} from "../infrastructure/media.repository"
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../infrastructure/storage/object-storage"
import { MediaConfig } from "../media.config"
import {
  isPropertyEditable,
  isPropertyPublic,
  MediaAccessService,
} from "./media-access.service"
import { MediaActivity } from "./media-activity"
import { MediaCleanupService } from "./media-cleanup.service"
import { MediaViews, primaryOf, type MediaView } from "./media-views"

export interface DownloadLink {
  url: string
  expiresAt: Date
}

/**
 * Médias d'un bien : lecture (publique ou gestionnaire), ordre, image
 * principale, suppression, téléchargement privé. Chaque écriture verrouille le
 * bien et passe par la politique d'accès des biens.
 */
@Injectable()
export class PropertyMediaService {
  constructor(
    private readonly media: MediaRepository,
    private readonly access: MediaAccessService,
    private readonly activity: MediaActivity,
    private readonly views: MediaViews,
    private readonly cleanup: MediaCleanupService,
    private readonly config: MediaConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /**
   * Public : médias prêts et publics d'un bien actif. Gestionnaire : tous les
   * médias non supprimés, avec statut, documents compris (sans URL).
   */
  async list(
    actor: Actor | null,
    propertyPublicId: string,
  ): Promise<{ manager: boolean; items: MediaView[] }> {
    const property = await this.media.findProperty(propertyPublicId)
    if (!property) throw mediaError("PROPERTY_NOT_FOUND")
    const manager = await this.access.canManage(actor, property)
    if (!manager && !isPropertyPublic(property)) {
      throw mediaError("PROPERTY_NOT_FOUND")
    }
    const rows = await this.media.listForProperty(property.id, !manager)
    const visible = manager
      ? rows
      : rows.filter((row) => row.type !== "DOCUMENT")
    const primaryId = primaryOf(visible)
    const items: MediaView[] = []
    for (const row of visible) {
      items.push(await this.views.media(row, { manager, primaryId }))
    }
    return { manager, items }
  }

  /** `mediaIds` doit lister exactement les médias actuels du bien, chacun une fois. */
  async reorder(
    actor: Actor,
    propertyPublicId: string,
    mediaIds: string[],
    client: ClientContext,
  ): Promise<MediaView[]> {
    await this.media.transaction(async (tx) => {
      const { property, override, rows } = await this.lockForWrite(
        actor,
        propertyPublicId,
        tx,
      )
      const current = new Map(rows.map((row) => [row.publicId, row]))
      if (
        mediaIds.length !== rows.length ||
        new Set(mediaIds).size !== mediaIds.length ||
        mediaIds.some((id) => !current.has(id))
      ) {
        throw mediaError("INVALID_MEDIA_ORDER")
      }
      const before = rows.map((row) => row.publicId)
      await this.applyOrder(mediaIds, current, tx)
      await this.activity.audit(
        {
          action: MediaAuditAction.REORDERED,
          actorId: actor.userId,
          entityType: "property",
          entityId: property.publicId,
          oldValues: { order: before },
          newValues: {
            order: mediaIds,
            ...(override ? { adminOverride: true } : {}),
          },
        },
        client,
        tx,
      )
    })
    this.changed(propertyPublicId, "reordered", client)
    return (await this.list(actor, propertyPublicId)).items
  }

  /** Image principale : la photo passe en tête, l'ordre relatif des autres est conservé. */
  async setPrimary(
    actor: Actor,
    propertyPublicId: string,
    mediaPublicId: string,
    client: ClientContext,
  ): Promise<MediaView> {
    await this.media.transaction(async (tx) => {
      const { property, override, rows } = await this.lockForWrite(
        actor,
        propertyPublicId,
        tx,
      )
      const target = rows.find((row) => row.publicId === mediaPublicId)
      if (!target) throw mediaError("MEDIA_NOT_FOUND")
      if (target.status !== "READY") throw mediaError("MEDIA_NOT_READY")
      if (!isPrimaryEligible(target)) {
        throw mediaError("MEDIA_NOT_PRIMARY_ELIGIBLE")
      }
      const previous = primaryOf(rows)
      if (previous === target.id) return
      const order = [
        target.publicId,
        ...rows
          .filter((row) => row.id !== target.id)
          .map((row) => row.publicId),
      ]
      await this.applyOrder(
        order,
        new Map(rows.map((row) => [row.publicId, row])),
        tx,
      )
      await this.activity.audit(
        {
          action: MediaAuditAction.PRIMARY_CHANGED,
          actorId: actor.userId,
          entityType: MEDIA_ENTITY,
          entityId: target.publicId,
          oldValues: {
            primary: rows.find((row) => row.id === previous)?.publicId ?? null,
          },
          newValues: {
            primary: target.publicId,
            propertyId: property.publicId,
            ...(override ? { adminOverride: true } : {}),
          },
        },
        client,
        tx,
      )
    })
    this.changed(propertyPublicId, "primary_changed", client)
    const row = await this.media.findByPublicId(mediaPublicId)
    return this.views.media(row!, { manager: true, primaryId: row!.id })
  }

  /**
   * Suppression logique : masqué immédiatement, variantes publiques retirées
   * du CDN, original conservé jusqu'à la purge (rétention, références Trust).
   */
  async remove(
    actor: Actor,
    propertyPublicId: string,
    mediaPublicId: string,
    client: ClientContext,
  ): Promise<void> {
    const removed = await this.media.transaction(async (tx) => {
      const { property, override } = await this.lockForWrite(
        actor,
        propertyPublicId,
        tx,
        false,
      )
      const row = await this.media.findByPublicId(mediaPublicId, tx)
      if (!row || row.propertyId !== property.id || row.deletedAt !== null) {
        throw mediaError("MEDIA_NOT_FOUND")
      }
      const now = new Date()
      await tx.media.update({
        where: { id: row.id },
        data: {
          deletedAt: now,
          url: null,
          nextAttemptAt: null,
          purgeAfter: new Date(
            now.getTime() + this.config.deletedRetentionDays * 86_400_000,
          ),
        },
      })
      await tx.mediaVariant.updateMany({
        where: { mediaId: row.id },
        data: { url: null },
      })
      await this.activity.audit(
        {
          action: MediaAuditAction.DELETED,
          actorId: actor.userId,
          entityType: MEDIA_ENTITY,
          entityId: row.publicId,
          oldValues: { status: row.status, type: row.type },
          newValues: {
            propertyId: property.publicId,
            ...(override ? { adminOverride: true } : {}),
          },
        },
        client,
        tx,
      )
      return row
    })

    await this.cleanup
      .unpublish(removed.publicId, removed.storageKey)
      .catch(() =>
        this.activity.metrics.media.storageErrors.inc({
          operation: "unpublish",
        }),
      )
    this.activity.emit(MediaEvent.DELETED, removed.publicId, {
      mediaId: removed.publicId,
      propertyId: propertyPublicId,
      type: removed.type,
    })
    if (removed.visibility === "PUBLIC" && removed.status === "READY") {
      this.changed(propertyPublicId, "deleted", client)
    }
    this.activity.log("media.deleted", client, {
      media_id: removed.publicId,
      property_id: propertyPublicId,
      type: removed.type,
    })
  }

  /**
   * Lien de téléchargement court pour un média privé ou un document :
   * gestionnaire du bien ou modération des justificatifs. Chaque accès à un
   * document est audité.
   */
  async download(
    actor: Actor,
    propertyPublicId: string,
    mediaPublicId: string,
    client: ClientContext,
  ): Promise<DownloadLink> {
    const row = await this.media.findByPublicId(mediaPublicId)
    const property = row?.property
    if (
      !row ||
      !property ||
      row.deletedAt !== null ||
      property.publicId !== propertyPublicId
    ) {
      throw mediaError("MEDIA_NOT_FOUND")
    }
    const manager = await this.access.canManage(actor, property)
    const reviewer =
      row.type === "DOCUMENT" && this.access.canReviewDocuments(actor)
    if (!manager && !reviewer) throw mediaError("MEDIA_NOT_FOUND")
    if (row.status !== "READY") throw mediaError("MEDIA_NOT_READY")

    const link = await this.signedOriginal(row)
    if (row.type === "DOCUMENT") {
      await this.activity.audit(
        {
          action: MediaAuditAction.DOCUMENT_ACCESSED,
          actorId: actor.userId,
          entityType: MEDIA_ENTITY,
          entityId: row.publicId,
          newValues: {
            propertyId: property.publicId,
            as: manager ? "manager" : "reviewer",
          },
        },
        client,
        this.media.client,
      )
    }
    this.activity.log("media.download_link", client, {
      media_id: row.publicId,
      type: row.type,
    })
    return link
  }

  async signedOriginal(row: MediaRow): Promise<DownloadLink> {
    const expiresInSeconds = this.config.downloadUrlTtlSeconds
    const url = await this.storage.createDownloadUrl(
      "private",
      row.storageKey,
      {
        expiresInSeconds,
        contentType: row.mimeType,
        filename: row.originalFilename ?? undefined,
      },
    )
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1_000) }
  }

  private async lockForWrite(
    actor: Actor,
    propertyPublicId: string,
    tx: Tx,
    requireEditable = true,
  ): Promise<{ property: PropertyRef; override: boolean; rows: MediaRow[] }> {
    const property = await this.media.lockProperty(propertyPublicId, tx)
    if (!property) throw mediaError("PROPERTY_NOT_FOUND")
    const { override } = await this.access.requireManager(actor, property, tx)
    if (requireEditable && !isPropertyEditable(property)) {
      throw mediaError("PROPERTY_NOT_EDITABLE")
    }
    const rows = await this.media.listForProperty(property.id, false, tx)
    return { property, override, rows }
  }

  private async applyOrder(
    order: string[],
    rows: Map<string, MediaRow>,
    tx: Tx,
  ): Promise<void> {
    for (const [index, publicId] of order.entries()) {
      const row = rows.get(publicId)!
      if (row.sortOrder !== index) {
        await tx.media.update({
          where: { id: row.id },
          data: { sortOrder: index },
        })
      }
    }
  }

  /** Invalide la recherche du bien seulement (pas de réindexation globale). */
  private changed(
    propertyPublicId: string,
    reason: string,
    client: ClientContext,
  ): void {
    this.activity.emit(MediaEvent.PROPERTY_MEDIA_CHANGED, propertyPublicId, {
      propertyId: propertyPublicId,
      reason,
    })
    this.activity.log("property.media_changed", client, {
      property_id: propertyPublicId,
      reason,
    })
  }
}
