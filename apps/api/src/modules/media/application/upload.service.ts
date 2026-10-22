import { Inject, Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import type { Tx } from "../../../database/database.service"
import type {
  MediaType,
  MediaVisibility,
} from "../../../generated/prisma/enums"
import type { Actor, ClientContext } from "../../identity"
import { detectFormat, SIGNATURE_BYTES } from "../domain/file-signature"
import { mediaError } from "../domain/media-errors"
import {
  MEDIA_ENTITY,
  MediaAuditAction,
  MediaEvent,
} from "../domain/media-events"
import {
  resolveVisibility,
  sanitizeFilename,
  signatureMatches,
  validateDeclaration,
} from "../domain/media-policy"
import { isPastUpload } from "../domain/media-status"
import { originalKey } from "../domain/storage-keys"
import {
  MediaRepository,
  type MediaRow,
} from "../infrastructure/media.repository"
import {
  OBJECT_STORAGE,
  StorageError,
  type ObjectStorage,
} from "../infrastructure/storage/object-storage"
import { MediaConfig } from "../media.config"
import { isPropertyEditable, MediaAccessService } from "./media-access.service"
import { MediaActivity } from "./media-activity"
import { MediaViews, type UploadSessionView } from "./media-views"

export interface CreateUploadInput {
  propertyId: string
  type: MediaType
  mimeType: string
  size: number
  filename?: string
  visibility?: MediaVisibility
}

export interface VerificationUploadInput {
  mimeType: string
  size: number
  filename?: string
}

export interface MessageUploadInput {
  type: "IMAGE" | "DOCUMENT"
  mimeType: string
  size: number
  filename?: string
}

/**
 * Exécuté dans la transaction qui crée le média : le module appelant y
 * rattache le fichier à son agrégat (dossier Trust, conversation), tout ou rien.
 */
export type AttachDetachedMedia = (
  tx: Tx,
  media: { id: bigint; publicId: string },
) => Promise<void>

export type AttachVerificationDocument = AttachDetachedMedia

/** Un envoi commencé avant l'échéance du lien peut se terminer un peu après. */
export const UPLOAD_GRACE_MS = 10 * 60_000

const EXTENSION_OF: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
}

/**
 * Envoi direct vers le stockage : la session réserve une clé générée par le
 * serveur et délivre une URL signée ; la confirmation relit l'objet réel
 * (présence, taille exacte, signature binaire) avant de le mettre en file.
 * Le client n'est jamais cru sur parole.
 */
@Injectable()
export class UploadService {
  constructor(
    private readonly media: MediaRepository,
    private readonly access: MediaAccessService,
    private readonly activity: MediaActivity,
    private readonly views: MediaViews,
    private readonly config: MediaConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async createSession(
    actor: Actor,
    input: CreateUploadInput,
    client: ClientContext,
  ): Promise<UploadSessionView> {
    const { mimeType } = validateDeclaration(input, this.config.limits)
    const visibility = resolveVisibility(input.type, input.visibility)
    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + this.config.uploadUrlTtlSeconds * 1_000,
    )
    const publicId = randomUUID()
    const storageKey = originalKey(
      publicId,
      input.type,
      EXTENSION_OF[mimeType]!,
    )

    const row = await this.media.transaction(async (tx) => {
      const property = await this.media.lockProperty(input.propertyId, tx)
      if (!property) throw mediaError("PROPERTY_NOT_FOUND")
      const { override } = await this.access.requireManager(actor, property, tx)
      if (!isPropertyEditable(property)) {
        throw mediaError("PROPERTY_NOT_EDITABLE")
      }
      if (
        (await this.media.countForProperty(property.id, tx)) >=
        this.config.limits.perProperty
      ) {
        throw mediaError(
          "MEDIA_LIMIT_REACHED",
          `maximum ${this.config.limits.perProperty}`,
        )
      }
      if (
        (await this.media.countOpenSessions(actor.userId, now, tx)) >=
        this.config.limits.pendingUploads
      ) {
        throw mediaError("TOO_MANY_PENDING_UPLOADS")
      }
      const created = await tx.media.create({
        data: {
          publicId,
          propertyId: property.id,
          type: input.type,
          storageProvider: this.storage.provider,
          storageKey,
          mimeType,
          fileSize: BigInt(input.size),
          status: "PENDING_UPLOAD",
          visibility,
          uploadedById: actor.userId,
          originalFilename: sanitizeFilename(input.filename),
          uploadExpiresAt: expiresAt,
          sortOrder: await this.media.nextSortOrder(property.id, tx),
        },
        select: { id: true },
      })
      await this.activity.audit(
        {
          action: MediaAuditAction.UPLOAD_STARTED,
          actorId: actor.userId,
          entityType: MEDIA_ENTITY,
          entityId: publicId,
          newValues: {
            propertyId: property.publicId,
            type: input.type,
            mimeType,
            size: input.size,
            visibility,
            ...(override ? { adminOverride: true } : {}),
          },
        },
        client,
        tx,
      )
      return this.media.findById(created.id, tx)
    })

    const upload = await this.presign(storageKey, mimeType, input.size)
    this.activity.metrics.media.uploadsStarted.inc({ type: input.type })
    this.activity.emit(MediaEvent.UPLOAD_STARTED, publicId, {
      mediaId: publicId,
      propertyId: input.propertyId,
      type: input.type,
    })
    this.activity.log("media.upload_started", client, {
      media_id: publicId,
      property_id: input.propertyId,
      type: input.type,
      size: input.size,
    })
    return this.views.session(row!, upload)
  }

  /**
   * Justificatif de vérification : document privé sans bien, lisible par son
   * seul auteur (et par les relecteurs Trust via `MediaDocumentAccess`),
   * jamais par les co-gestionnaires d'un bien ni dans une galerie.
   */
  createVerificationSession(
    actor: Actor,
    input: VerificationUploadInput,
    client: ClientContext,
    attach: AttachVerificationDocument,
  ): Promise<UploadSessionView> {
    return this.createDetachedSession(
      actor,
      { ...input, purpose: "VERIFICATION", type: "DOCUMENT" },
      client,
      attach,
    )
  }

  /**
   * Pièce jointe de message : image ou document privé sans bien, lisible par
   * son auteur ; les participants y accèdent par la messagerie, qui vérifie
   * leurs droits avant de demander un lien (`MediaAttachmentAccess`).
   */
  createMessageSession(
    actor: Actor,
    input: MessageUploadInput,
    client: ClientContext,
    attach: AttachDetachedMedia,
  ): Promise<UploadSessionView> {
    return this.createDetachedSession(
      actor,
      { ...input, purpose: "MESSAGE" },
      client,
      attach,
    )
  }

  private async createDetachedSession(
    actor: Actor,
    input: {
      purpose: "VERIFICATION" | "MESSAGE"
      type: "IMAGE" | "DOCUMENT"
      mimeType: string
      size: number
      filename?: string
    },
    client: ClientContext,
    attach: AttachDetachedMedia,
  ): Promise<UploadSessionView> {
    const { purpose, type } = input
    const { mimeType } = validateDeclaration(input, this.config.limits)
    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + this.config.uploadUrlTtlSeconds * 1_000,
    )
    const publicId = randomUUID()
    const storageKey = originalKey(publicId, type, EXTENSION_OF[mimeType]!)

    const row = await this.media.transaction(async (tx) => {
      if (
        (await this.media.countOpenSessions(actor.userId, now, tx)) >=
        this.config.limits.pendingUploads
      ) {
        throw mediaError("TOO_MANY_PENDING_UPLOADS")
      }
      const created = await tx.media.create({
        data: {
          publicId,
          purpose,
          type,
          storageProvider: this.storage.provider,
          storageKey,
          mimeType,
          fileSize: BigInt(input.size),
          status: "PENDING_UPLOAD",
          visibility: "PRIVATE",
          uploadedById: actor.userId,
          originalFilename: sanitizeFilename(input.filename),
          uploadExpiresAt: expiresAt,
        },
        select: { id: true },
      })
      await attach(tx, { id: created.id, publicId })
      await this.activity.audit(
        {
          action: MediaAuditAction.UPLOAD_STARTED,
          actorId: actor.userId,
          entityType: MEDIA_ENTITY,
          entityId: publicId,
          newValues: { purpose, type, mimeType, size: input.size },
        },
        client,
        tx,
      )
      return this.media.findById(created.id, tx)
    })

    const upload = await this.presign(storageKey, mimeType, input.size)
    this.activity.metrics.media.uploadsStarted.inc({ type })
    this.activity.emit(MediaEvent.UPLOAD_STARTED, publicId, {
      mediaId: publicId,
      propertyId: null,
      purpose,
      type,
    })
    this.activity.log("media.upload_started", client, {
      media_id: publicId,
      purpose,
      type,
      size: input.size,
    })
    return this.views.session(row!, upload)
  }

  async getSession(
    actor: Actor,
    sessionId: string,
  ): Promise<UploadSessionView> {
    const row = await this.readable(actor, sessionId)
    return this.views.session(row)
  }

  /**
   * Idempotent : une session déjà confirmée (ou refusée) renvoie son état sans
   * effet. Une absence d'objet laisse la session ouverte (nouvel essai possible).
   */
  async complete(
    actor: Actor,
    sessionId: string,
    client: ClientContext,
  ): Promise<UploadSessionView> {
    const row = await this.readable(actor, sessionId)
    if (isPastUpload(row.status) || row.deletedAt !== null) {
      return this.views.session(row)
    }
    // L'auteur doit encore gérer le bien : un mandat retiré entre-temps bloque la confirmation.
    if (row.property) await this.access.requireManager(actor, row.property)
    if (
      row.uploadExpiresAt &&
      row.uploadExpiresAt.getTime() + UPLOAD_GRACE_MS < Date.now()
    ) {
      await this.media.client.media.updateMany({
        where: { id: row.id, status: "PENDING_UPLOAD" },
        data: {
          status: "FAILED",
          processingError: "UPLOAD_EXPIRED",
          deletedAt: new Date(),
          purgeAfter: new Date(),
        },
      })
      throw mediaError("UPLOAD_SESSION_EXPIRED")
    }

    let info
    let head
    try {
      info = await this.storage.head("private", row.storageKey)
      head = info
        ? await this.storage.readRange(
            "private",
            row.storageKey,
            0,
            Math.min(SIGNATURE_BYTES, info.size),
          )
        : null
    } catch (error) {
      this.storageFailure("verify", error)
    }
    if (!info || !head) throw mediaError("UPLOAD_NOT_RECEIVED")

    if (info.size !== Number(row.fileSize)) {
      await this.reject(row, "SIZE_MISMATCH", client)
      throw mediaError("UPLOAD_SIZE_MISMATCH")
    }
    const detected = detectFormat(head)
    if (!signatureMatches(row.type, row.mimeType, detected?.mime ?? null)) {
      await this.reject(row, "CONTENT_MISMATCH", client)
      throw mediaError("UPLOAD_CONTENT_MISMATCH")
    }

    const now = new Date()
    const updated = await this.media.client.media.updateMany({
      where: { id: row.id, status: "PENDING_UPLOAD", deletedAt: null },
      data: {
        status: "UPLOADED",
        uploadedAt: now,
        nextAttemptAt: now,
        processingAttempts: 0,
        processingError: null,
      },
    })
    const current = await this.media.findById(row.id)
    if (updated.count === 1) {
      this.activity.metrics.media.uploadsCompleted.inc({ type: row.type })
      this.activity.metrics.media.uploadBytes.observe(
        { type: row.type },
        info.size,
      )
      this.activity.emit(MediaEvent.UPLOADED, row.publicId, {
        mediaId: row.publicId,
        propertyId: row.property?.publicId ?? null,
        purpose: row.purpose,
        type: row.type,
      })
      this.activity.log("media.uploaded", client, {
        media_id: row.publicId,
        property_id: row.property?.publicId ?? null,
        purpose: row.purpose,
        type: row.type,
        size: info.size,
      })
    }
    return this.views.session(current!)
  }

  /**
   * Session lisible par son auteur ou par un gestionnaire du bien ; un
   * justificatif de vérification, par son seul auteur. Tout autre acteur
   * reçoit 404 : l'existence d'une session ne fuit pas.
   */
  private async readable(actor: Actor, sessionId: string): Promise<MediaRow> {
    const row = await this.media.findByPublicId(sessionId)
    if (!row) throw mediaError("UPLOAD_SESSION_NOT_FOUND")
    if (row.uploadedById === actor.userId) return row
    if (row.property && (await this.access.canManage(actor, row.property))) {
      return row
    }
    throw mediaError("UPLOAD_SESSION_NOT_FOUND")
  }

  private async presign(storageKey: string, mimeType: string, size: number) {
    try {
      return await this.storage.createUploadTarget(storageKey, {
        contentType: mimeType,
        contentLength: size,
        expiresInSeconds: this.config.uploadUrlTtlSeconds,
      })
    } catch (error) {
      this.storageFailure("presign", error)
    }
  }

  /** Fichier non conforme : refusé, masqué, objet supprimé au prochain passage de purge. */
  private async reject(
    row: MediaRow,
    reason: string,
    client: ClientContext,
  ): Promise<void> {
    const now = new Date()
    await this.media.client.media.updateMany({
      where: { id: row.id, status: "PENDING_UPLOAD" },
      data: {
        status: "REJECTED",
        processingError: reason,
        deletedAt: now,
        purgeAfter: now,
        nextAttemptAt: null,
      },
    })
    this.activity.metrics.media.rejected.inc({ type: row.type, reason })
    this.activity.emit(MediaEvent.REJECTED, row.publicId, {
      mediaId: row.publicId,
      propertyId: row.property?.publicId ?? null,
      purpose: row.purpose,
      reason,
    })
    this.activity.log("media.rejected", client, {
      media_id: row.publicId,
      type: row.type,
      reason,
    })
  }

  private storageFailure(operation: string, error: unknown): never {
    this.activity.metrics.media.storageErrors.inc({ operation })
    this.activity.log("media.storage_error", null, {
      operation,
      code: error instanceof StorageError ? error.code : "UNKNOWN",
    })
    throw mediaError("STORAGE_UNAVAILABLE")
  }
}
