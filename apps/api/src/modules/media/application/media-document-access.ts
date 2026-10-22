import { Injectable } from "@nestjs/common"

import type {
  MediaPurpose,
  MediaStatus,
} from "../../../generated/prisma/enums"
import type { Actor, ClientContext } from "../../identity"
import type { ScanResult } from "../infrastructure/processing/document-scanner"
import {
  MediaRepository,
  type MediaRow,
} from "../infrastructure/media.repository"
import { MediaConfig } from "../media.config"
import { MediaActivity } from "./media-activity"
import { MEDIA_ENTITY, MediaAuditAction } from "../domain/media-events"
import type { UploadSessionView } from "./media-views"
import {
  PropertyMediaService,
  type DownloadLink,
} from "./property-media.service"
import {
  UploadService,
  type AttachVerificationDocument,
  type VerificationUploadInput,
} from "./upload.service"

export interface MediaDocumentInfo {
  /** Identifiant interne : clé étrangère `verification_documents.media_id`. */
  id: bigint
  mediaId: string
  purpose: MediaPurpose
  /** Nul pour un justificatif de vérification. */
  propertyId: string | null
  uploadedById: bigint | null
  status: MediaStatus
  mimeType: string
  fileSize: number
  /** `NOT_SCANNED` tant qu'aucun antivirus n'est branché. */
  scan: ScanResult | null
  /** Empreinte SHA-256 de l'original, connue une fois le traitement terminé. */
  contentSha256: string | null
  deleted: boolean
  /** Clé interne ; jamais exposée au client. */
  storageReference: string
}

/**
 * Contrat offert au module Trust (vérifications) : ouvrir l'envoi d'un
 * justificatif, lire son état, repérer un contenu réutilisé, obtenir un lien
 * de lecture court pour un relecteur dont Trust a déjà vérifié les droits, et
 * retirer le fichier à l'échéance de rétention. Le document reste privé, en
 * quarantaine (`q/`), hors de toute galerie de bien.
 */
export interface MediaDocumentAccess {
  createVerificationUpload(
    actor: Actor,
    input: VerificationUploadInput,
    client: ClientContext,
    attach: AttachVerificationDocument,
  ): Promise<UploadSessionView>
  describe(mediaPublicId: string): Promise<MediaDocumentInfo | null>
  describeMany(mediaIds: bigint[]): Promise<Map<bigint, MediaDocumentInfo>>
  /** Autres auteurs d'un fichier identique (hors l'auteur de ce média). */
  otherUploadersOfSameContent(mediaId: bigint): Promise<bigint[]>
  createReviewLink(
    mediaPublicId: string,
    reviewer: { userId: bigint; requestId?: string | null },
  ): Promise<DownloadLink | null>
  /** Masque le fichier et planifie sa purge (rétention échue, retrait). */
  retire(
    mediaId: bigint,
    options: { immediate: boolean },
  ): Promise<boolean>
}

@Injectable()
export class MediaDocumentService implements MediaDocumentAccess {
  constructor(
    private readonly media: MediaRepository,
    private readonly uploads: UploadService,
    private readonly properties: PropertyMediaService,
    private readonly activity: MediaActivity,
    private readonly config: MediaConfig,
  ) {}

  createVerificationUpload(
    actor: Actor,
    input: VerificationUploadInput,
    client: ClientContext,
    attach: AttachVerificationDocument,
  ): Promise<UploadSessionView> {
    return this.uploads.createVerificationSession(actor, input, client, attach)
  }

  async describe(mediaPublicId: string): Promise<MediaDocumentInfo | null> {
    const row = await this.media.findByPublicId(mediaPublicId)
    return row && row.type === "DOCUMENT" ? toInfo(row) : null
  }

  async describeMany(
    mediaIds: bigint[],
  ): Promise<Map<bigint, MediaDocumentInfo>> {
    if (mediaIds.length === 0) return new Map()
    const rows = await Promise.all(
      [...new Set(mediaIds)].map((id) => this.media.findById(id)),
    )
    return new Map(
      rows.flatMap((row) =>
        row && row.type === "DOCUMENT" ? [[row.id, toInfo(row)]] : [],
      ),
    )
  }

  async otherUploadersOfSameContent(mediaId: bigint): Promise<bigint[]> {
    const row = await this.media.findById(mediaId)
    if (!row?.contentSha256) return []
    const uploaders = await this.media.uploadersOfSameContent(
      row.contentSha256,
      row.id,
    )
    return uploaders.filter((id) => id !== row.uploadedById)
  }

  async createReviewLink(
    mediaPublicId: string,
    reviewer: { userId: bigint; requestId?: string | null },
  ): Promise<DownloadLink | null> {
    const row = await this.media.findByPublicId(mediaPublicId)
    if (
      !row ||
      row.type !== "DOCUMENT" ||
      row.deletedAt !== null ||
      row.status !== "READY"
    ) {
      return null
    }
    const link = await this.properties.signedOriginal(row)
    await this.activity.audit(
      {
        action: MediaAuditAction.DOCUMENT_ACCESSED,
        actorId: reviewer.userId,
        entityType: MEDIA_ENTITY,
        entityId: row.publicId,
        newValues: {
          propertyId: row.property?.publicId ?? null,
          purpose: row.purpose,
          as: "trust",
        },
      },
      { ip: null, userAgent: null, requestId: reviewer.requestId ?? null },
      this.media.client,
    )
    return link
  }

  async retire(
    mediaId: bigint,
    options: { immediate: boolean },
  ): Promise<boolean> {
    const now = new Date()
    const result = await this.media.client.media.updateMany({
      where: { id: mediaId, purpose: "VERIFICATION", deletedAt: null },
      data: {
        deletedAt: now,
        nextAttemptAt: null,
        purgeAfter: options.immediate
          ? now
          : new Date(
              now.getTime() + this.config.deletedRetentionDays * 86_400_000,
            ),
      },
    })
    return result.count === 1
  }
}

function toInfo(row: MediaRow): MediaDocumentInfo {
  const metadata = row.metadata as { scan?: ScanResult }
  return {
    id: row.id,
    mediaId: row.publicId,
    purpose: row.purpose,
    propertyId: row.property?.publicId ?? null,
    uploadedById: row.uploadedById,
    status: row.status,
    mimeType: row.mimeType,
    fileSize: Number(row.fileSize),
    scan: metadata.scan ?? null,
    contentSha256: row.contentSha256,
    deleted: row.deletedAt !== null,
    storageReference: row.storageKey,
  }
}

export const MEDIA_DOCUMENT_ACCESS = Symbol("MEDIA_DOCUMENT_ACCESS")
