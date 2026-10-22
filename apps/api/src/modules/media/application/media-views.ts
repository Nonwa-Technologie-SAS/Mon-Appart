import { Inject, Injectable } from "@nestjs/common"

import type {
  MediaStatus,
  MediaType,
  MediaVariantKind,
  MediaVisibility,
} from "../../../generated/prisma/enums"
import { isPrimaryEligible } from "../domain/media-policy"
import type { MediaRow } from "../infrastructure/media.repository"
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  type UploadTarget,
} from "../infrastructure/storage/object-storage"
import { MediaConfig } from "../media.config"

export interface VariantView {
  kind: MediaVariantKind
  url: string
  width: number | null
  height: number | null
}

export interface MediaView {
  id: string
  /** Nul pour un justificatif de vérification (sans bien). */
  propertyId: string | null
  type: MediaType
  status: MediaStatus
  visibility: MediaVisibility
  mimeType: string
  fileSize: number
  width: number | null
  height: number | null
  durationMs: number | null
  sortOrder: number
  isPrimary: boolean
  /** Couverture (variante CARD) ou lecture vidéo ; nulle pour un document. */
  url: string | null
  variants: VariantView[]
  createdAt: Date
  readyAt: Date | null
  /** Vue gestionnaire uniquement. */
  originalFilename?: string | null
  errorCode?: string | null
}

export interface UploadSessionView {
  sessionId: string
  mediaId: string
  propertyId: string | null
  type: MediaType
  status: MediaStatus
  expiresAt: Date | null
  errorCode: string | null
  /** Le fichier doit faire exactement `contentLength` octets. */
  upload?: UploadTarget & { contentLength: number }
  media?: MediaView
}

/**
 * Construit les vues exposées. Une variante du bucket public a une URL
 * permanente ; une variante privée (pas de bucket public, média privé) reçoit
 * une URL présignée courte générée à la lecture, jamais stockée.
 */
@Injectable()
export class MediaViews {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly config: MediaConfig,
  ) {}

  async media(
    row: MediaRow,
    options: { manager: boolean; primaryId?: bigint | null },
  ): Promise<MediaView> {
    const ready = row.status === "READY" && row.purgedAt === null
    const variants: VariantView[] = []
    if (ready && row.type !== "DOCUMENT") {
      for (const variant of row.variants) {
        variants.push({
          kind: variant.kind,
          url:
            variant.url ??
            (await this.storage.createDownloadUrl(
              variant.isPublic ? "public" : "private",
              variant.storageKey,
              {
                expiresInSeconds: this.config.downloadUrlTtlSeconds,
                contentType: variant.mimeType,
                inline: true,
              },
            )),
          width: variant.width,
          height: variant.height,
        })
      }
    }
    const cover =
      variants.find((variant) => variant.kind === "CARD") ??
      variants.find((variant) => variant.kind === "PLAYBACK") ??
      null
    return {
      id: row.publicId,
      propertyId: row.property?.publicId ?? null,
      type: row.type,
      status: row.status,
      visibility: row.visibility,
      mimeType: row.mimeType,
      fileSize: Number(row.fileSize),
      width: row.width,
      height: row.height,
      durationMs: row.durationMs,
      sortOrder: row.sortOrder,
      isPrimary: options.primaryId === row.id,
      url: cover?.url ?? null,
      variants,
      createdAt: row.createdAt,
      readyAt: row.readyAt,
      ...(options.manager
        ? {
            originalFilename: row.originalFilename,
            errorCode: row.processingError,
          }
        : {}),
    }
  }

  async session(
    row: MediaRow,
    upload?: UploadTarget,
  ): Promise<UploadSessionView> {
    return {
      sessionId: row.publicId,
      mediaId: row.publicId,
      propertyId: row.property?.publicId ?? null,
      type: row.type,
      status: row.status,
      expiresAt: row.uploadExpiresAt,
      errorCode: row.processingError,
      ...(upload
        ? { upload: { ...upload, contentLength: Number(row.fileSize) } }
        : {}),
      ...(row.status === "READY" && row.deletedAt === null
        ? { media: await this.media(row, { manager: true }) }
        : {}),
    }
  }
}

/** Image principale : première photo affichable dans l'ordre du bien. */
export function primaryOf(rows: readonly MediaRow[]): bigint | null {
  return rows.find((row) => isPrimaryEligible(row))?.id ?? null
}
