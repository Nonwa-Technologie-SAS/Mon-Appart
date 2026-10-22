import { Inject, Injectable } from "@nestjs/common"

import type { MediaStatus, MediaType } from "../../../generated/prisma/enums"
import type { Actor, ClientContext } from "../../identity"
import { MEDIA_ENTITY, MediaAuditAction } from "../domain/media-events"
import {
  MediaRepository,
  type MediaRow,
} from "../infrastructure/media.repository"
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../infrastructure/storage/object-storage"
import { MediaConfig } from "../media.config"
import { MediaActivity } from "./media-activity"
import type { UploadSessionView } from "./media-views"
import {
  PropertyMediaService,
  type DownloadLink,
} from "./property-media.service"
import {
  UploadService,
  type AttachDetachedMedia,
  type MessageUploadInput,
} from "./upload.service"

export interface MediaAttachmentInfo {
  /** Identifiant interne : clé étrangère `message_attachments.media_id`. */
  id: bigint
  mediaId: string
  type: MediaType
  status: MediaStatus
  mimeType: string
  fileSize: number
  filename: string | null
  width: number | null
  height: number | null
  uploadedById: bigint | null
  deleted: boolean
}

/**
 * Contrat offert à la messagerie : ouvrir l'envoi d'une pièce jointe privée,
 * lire son état, et obtenir un lien de lecture court pour un participant dont
 * la messagerie a déjà vérifié les droits. Les fichiers restent dans le
 * stockage objet ; la table des messages ne porte que des références.
 */
export interface MediaAttachmentAccess {
  createMessageUpload(
    actor: Actor,
    input: MessageUploadInput,
    client: ClientContext,
    attach: AttachDetachedMedia,
  ): Promise<UploadSessionView>
  describeMany(mediaIds: bigint[]): Promise<Map<bigint, MediaAttachmentInfo>>
  createAttachmentLink(
    mediaId: bigint,
    viewer: { userId: bigint; requestId?: string | null },
  ): Promise<DownloadLink | null>
}

/** Variante servie pour une image : métadonnées (EXIF, GPS) retirées. */
const IMAGE_VARIANT_PREFERENCE = ["LARGE", "GALLERY", "CARD"] as const

@Injectable()
export class MediaAttachmentService implements MediaAttachmentAccess {
  constructor(
    private readonly media: MediaRepository,
    private readonly uploads: UploadService,
    private readonly properties: PropertyMediaService,
    private readonly activity: MediaActivity,
    private readonly config: MediaConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  createMessageUpload(
    actor: Actor,
    input: MessageUploadInput,
    client: ClientContext,
    attach: AttachDetachedMedia,
  ): Promise<UploadSessionView> {
    return this.uploads.createMessageSession(actor, input, client, attach)
  }

  async describeMany(
    mediaIds: bigint[],
  ): Promise<Map<bigint, MediaAttachmentInfo>> {
    if (mediaIds.length === 0) return new Map()
    const rows = await this.media.client.media.findMany({
      where: { id: { in: [...new Set(mediaIds)] }, purpose: "MESSAGE" },
      select: {
        id: true,
        publicId: true,
        type: true,
        status: true,
        mimeType: true,
        fileSize: true,
        originalFilename: true,
        width: true,
        height: true,
        uploadedById: true,
        deletedAt: true,
      },
    })
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          mediaId: row.publicId,
          type: row.type,
          status: row.status,
          mimeType: row.mimeType,
          fileSize: Number(row.fileSize),
          filename: row.originalFilename,
          width: row.width,
          height: row.height,
          uploadedById: row.uploadedById,
          deleted: row.deletedAt !== null,
        },
      ]),
    )
  }

  async createAttachmentLink(
    mediaId: bigint,
    viewer: { userId: bigint; requestId?: string | null },
  ): Promise<DownloadLink | null> {
    const row = await this.media.findById(mediaId)
    if (
      !row ||
      row.purpose !== "MESSAGE" ||
      row.deletedAt !== null ||
      row.status !== "READY"
    ) {
      return null
    }
    const link =
      row.type === "IMAGE"
        ? await this.signedImage(row)
        : await this.properties.signedOriginal(row)
    if (!link) return null
    await this.activity.audit(
      {
        action: MediaAuditAction.ATTACHMENT_ACCESSED,
        actorId: viewer.userId,
        entityType: MEDIA_ENTITY,
        entityId: row.publicId,
        newValues: { purpose: row.purpose, type: row.type },
      },
      { ip: null, userAgent: null, requestId: viewer.requestId ?? null },
      this.media.client,
    )
    return link
  }

  private async signedImage(row: MediaRow): Promise<DownloadLink | null> {
    const variant = IMAGE_VARIANT_PREFERENCE.map((kind) =>
      row.variants.find((candidate) => candidate.kind === kind),
    ).find((candidate) => candidate !== undefined)
    if (!variant) return null
    const expiresInSeconds = this.config.downloadUrlTtlSeconds
    const url = await this.storage.createDownloadUrl(
      variant.isPublic ? "public" : "private",
      variant.storageKey,
      { expiresInSeconds, contentType: variant.mimeType, inline: true },
    )
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1_000) }
  }
}

export const MEDIA_ATTACHMENT_ACCESS = Symbol("MEDIA_ATTACHMENT_ACCESS")
