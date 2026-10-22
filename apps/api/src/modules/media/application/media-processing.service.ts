import { Inject, Injectable } from "@nestjs/common"
import { createHash } from "node:crypto"

import type { Prisma } from "../../../generated/prisma/client"
import type { MediaVariantKind } from "../../../generated/prisma/enums"
import { MediaProcessingError, rejectMedia } from "../domain/media-errors"
import { MediaEvent } from "../domain/media-events"
import { COVER_VARIANT } from "../domain/media-policy"
import { retryDelayMs } from "../domain/media-status"
import { inspectPdf } from "../domain/pdf-inspection"
import { variantKey } from "../domain/storage-keys"
import {
  MediaRepository,
  type ClaimedJob,
  type MediaRow,
} from "../infrastructure/media.repository"
import {
  DOCUMENT_SCANNER,
  type DocumentScanner,
} from "../infrastructure/processing/document-scanner"
import {
  assertDecodableImage,
  processImage,
} from "../infrastructure/processing/image-processor"
import {
  VIDEO_PROCESSOR,
  type VideoProcessor,
} from "../infrastructure/processing/video-processor"
import {
  OBJECT_STORAGE,
  StorageError,
  type BucketScope,
  type ObjectStorage,
} from "../infrastructure/storage/object-storage"
import { MediaConfig } from "../media.config"
import { MediaActivity } from "./media-activity"

export type JobOutcome = "READY" | "REJECTED" | "RETRY" | "FAILED" | "LOST"

interface VariantRecord {
  kind: MediaVariantKind
  storageKey: string
  isPublic: boolean
  url: string | null
  mimeType: string
  fileSize: number
  width: number | null
  height: number | null
}

interface ProcessingResult {
  width: number | null
  height: number | null
  durationMs: number | null
  metadata: Prisma.InputJsonObject
  variants: VariantRecord[]
  /** Empreinte de l'original lu en entier (images, documents) ; nulle pour une vidéo. */
  contentSha256: string | null
}

const PUBLIC_CACHE = "public, max-age=604800"
const PRIVATE_CACHE = "private, no-store"

/**
 * Traitement d'un média pris dans la file : idempotent (variantes à clés
 * déterministes, remplacées en une transaction), borné dans le temps, et
 * conditionné à la détention du travail (compteur d'essais).
 */
@Injectable()
export class MediaProcessingService {
  constructor(
    private readonly media: MediaRepository,
    private readonly config: MediaConfig,
    private readonly activity: MediaActivity,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIDEO_PROCESSOR) private readonly video: VideoProcessor,
    @Inject(DOCUMENT_SCANNER) private readonly scanner: DocumentScanner,
  ) {}

  async run(job: ClaimedJob): Promise<JobOutcome> {
    const row = await this.media.findById(job.id)
    if (!row || row.status !== "PROCESSING" || row.deletedAt !== null) {
      return "LOST"
    }
    if (job.attempt > this.config.worker.maxAttempts) {
      return this.fail(job, row, "MAX_ATTEMPTS_EXCEEDED")
    }
    const started = Date.now()
    try {
      const result = await withTimeout(
        this.process(row),
        this.config.worker.timeoutMs,
      )
      const outcome = await this.commit(job, row, result)
      this.activity.metrics.media.processingDuration.observe(
        { type: row.type },
        Date.now() - started,
      )
      return outcome
    } catch (error) {
      if (error instanceof MediaProcessingError && error.permanent) {
        return this.reject(job, row, error.code)
      }
      const code =
        error instanceof MediaProcessingError || error instanceof StorageError
          ? error.code
          : "PROCESSING_ERROR"
      if (job.attempt >= this.config.worker.maxAttempts) {
        return this.fail(job, row, code)
      }
      const kept = await this.media.finishJob(job, {
        status: "UPLOADED",
        nextAttemptAt: new Date(Date.now() + retryDelayMs(job.attempt)),
        processingError: code,
      })
      this.activity.log("media.processing_retry", null, {
        media_id: row.publicId,
        type: row.type,
        attempt: job.attempt,
        code,
      })
      return kept ? "RETRY" : "LOST"
    }
  }

  private async process(row: MediaRow): Promise<ProcessingResult> {
    if (row.type === "IMAGE" || row.type === "IMAGE_360") return this.image(row)
    if (row.type === "VIDEO") return this.videoOf(row)
    return this.document(row)
  }

  private async image(row: MediaRow): Promise<ProcessingResult> {
    const input = await this.storage.read(
      "private",
      row.storageKey,
      this.config.limits.imageBytes,
    )
    const image = await processImage(
      input,
      row.type,
      row.mimeType,
      this.config.limits.imagePixels,
    )
    const isPublic = this.publishes(row)
    const scope: BucketScope = isPublic ? "public" : "private"
    const variants: VariantRecord[] = []
    for (const variant of image.variants) {
      const key = variantKey(row.publicId, variant.spec.kind, "webp")
      await this.storage.write(scope, key, variant.body, {
        contentType: "image/webp",
        cacheControl: isPublic ? PUBLIC_CACHE : PRIVATE_CACHE,
      })
      variants.push({
        kind: variant.spec.kind,
        storageKey: key,
        isPublic,
        url: isPublic ? this.storage.publicUrl(key) : null,
        mimeType: "image/webp",
        fileSize: variant.body.length,
        width: variant.width,
        height: variant.height,
      })
    }
    return {
      width: image.width,
      height: image.height,
      durationMs: null,
      metadata: { sourceFormat: image.sourceFormat },
      variants,
      contentSha256: sha256(input),
    }
  }

  private async videoOf(row: MediaRow): Promise<ProcessingResult> {
    const size = Number(row.fileSize)
    const check = await this.video.check(
      (start, length) =>
        this.storage.readRange("private", row.storageKey, start, length),
      size,
      row.mimeType,
      this.config.limits.videoSeconds,
    )
    const isPublic = this.publishes(row)
    let playback: VariantRecord
    if (isPublic) {
      const extension = row.storageKey.slice(
        row.storageKey.lastIndexOf(".") + 1,
      )
      const key = variantKey(row.publicId, "PLAYBACK", extension)
      await this.storage.copy(
        { scope: "private", key: row.storageKey },
        { scope: "public", key },
        { contentType: row.mimeType, cacheControl: PUBLIC_CACHE },
      )
      playback = {
        kind: "PLAYBACK",
        storageKey: key,
        isPublic: true,
        url: this.storage.publicUrl(key),
        mimeType: row.mimeType,
        fileSize: size,
        width: null,
        height: null,
      }
    } else {
      // Sans espace public : lecture de l'original par URL présignée courte.
      playback = {
        kind: "PLAYBACK",
        storageKey: row.storageKey,
        isPublic: false,
        url: null,
        mimeType: row.mimeType,
        fileSize: size,
        width: null,
        height: null,
      }
    }
    return {
      width: null,
      height: null,
      durationMs: check.durationMs,
      metadata: {
        processor: this.video.name,
        inspected: check.inspected,
        codecs: check.codecs,
      },
      variants: [playback],
      contentSha256: null,
    }
  }

  private async document(row: MediaRow): Promise<ProcessingResult> {
    const content = await this.storage.read(
      "private",
      row.storageKey,
      this.config.limits.documentBytes,
    )
    let width: number | null = null
    let height: number | null = null
    if (row.mimeType === "application/pdf") {
      const pdf = inspectPdf(content)
      if (!pdf.valid) throw rejectMedia("DOCUMENT_UNREADABLE")
      if (pdf.activeContent.length > 0) {
        throw rejectMedia("DOCUMENT_ACTIVE_CONTENT")
      }
    } else {
      ;({ width, height } = await assertDecodableImage(
        content,
        row.mimeType,
        this.config.limits.imagePixels,
      ))
    }
    const scan = await this.scanner.scan(content, row.mimeType)
    if (scan === "INFECTED") throw rejectMedia("DOCUMENT_INFECTED")
    return {
      width,
      height,
      durationMs: null,
      metadata: { scan, scanner: this.scanner.name },
      variants: [],
      contentSha256: sha256(content),
    }
  }

  private publishes(row: MediaRow): boolean {
    return row.visibility === "PUBLIC" && this.storage.hasPublicBucket
  }

  private async commit(
    job: ClaimedJob,
    row: MediaRow,
    result: ProcessingResult,
  ): Promise<JobOutcome> {
    const cover =
      result.variants.find((variant) => variant.kind === COVER_VARIANT) ??
      result.variants.find((variant) => variant.kind === "PLAYBACK")
    const committed = await this.media
      .transaction(async (tx) => {
        await tx.mediaVariant.deleteMany({ where: { mediaId: row.id } })
        if (result.variants.length > 0) {
          await tx.mediaVariant.createMany({
            data: result.variants.map((variant) => ({
              mediaId: row.id,
              kind: variant.kind,
              storageProvider: row.storageProvider,
              storageKey: variant.storageKey,
              isPublic: variant.isPublic,
              url: variant.url,
              mimeType: variant.mimeType,
              fileSize: BigInt(variant.fileSize),
              width: variant.width,
              height: variant.height,
            })),
          })
        }
        const owned = await this.media.finishJob(
          job,
          {
            status: "READY",
            width: result.width,
            height: result.height,
            durationMs: result.durationMs,
            url: row.visibility === "PUBLIC" ? (cover?.url ?? null) : null,
            metadata: result.metadata,
            contentSha256: result.contentSha256,
            readyAt: new Date(),
            nextAttemptAt: null,
            processingError: null,
          },
          tx,
        )
        // Bail perdu (un autre worker a repris le travail) : on annule tout.
        if (!owned) throw new LostLeaseError()
        return true
      })
      .catch((error: unknown) => {
        if (error instanceof LostLeaseError) return false
        throw error
      })
    if (!committed) return "LOST"

    this.activity.metrics.media.processed.inc({
      type: row.type,
      outcome: "ready",
    })
    this.activity.emit(MediaEvent.READY, row.publicId, {
      mediaId: row.publicId,
      propertyId: row.property?.publicId ?? null,
      purpose: row.purpose,
      type: row.type,
    })
    if (row.visibility === "PUBLIC" && row.property) {
      this.activity.emit(
        MediaEvent.PROPERTY_MEDIA_CHANGED,
        row.property.publicId,
        { propertyId: row.property.publicId, reason: "media_ready" },
      )
    }
    this.activity.log("media.ready", null, {
      media_id: row.publicId,
      type: row.type,
      attempt: job.attempt,
      variants: result.variants.length,
    })
    return "READY"
  }

  private async reject(
    job: ClaimedJob,
    row: MediaRow,
    code: string,
  ): Promise<JobOutcome> {
    const now = new Date()
    const owned = await this.media.finishJob(job, {
      status: "REJECTED",
      processingError: code,
      nextAttemptAt: null,
      deletedAt: now,
      purgeAfter: now,
    })
    if (!owned) return "LOST"
    this.activity.metrics.media.rejected.inc({ type: row.type, reason: code })
    this.activity.metrics.media.processed.inc({
      type: row.type,
      outcome: "rejected",
    })
    this.activity.emit(MediaEvent.REJECTED, row.publicId, {
      mediaId: row.publicId,
      propertyId: row.property?.publicId ?? null,
      purpose: row.purpose,
      reason: code,
    })
    this.activity.log("media.rejected", null, {
      media_id: row.publicId,
      type: row.type,
      reason: code,
    })
    return "REJECTED"
  }

  /** Échec définitif : masqué, objets conservés pendant la rétention pour analyse. */
  private async fail(
    job: ClaimedJob,
    row: MediaRow,
    code: string,
  ): Promise<JobOutcome> {
    const now = new Date()
    const owned = await this.media.finishJob(job, {
      status: "FAILED",
      processingError: code,
      nextAttemptAt: null,
      deletedAt: now,
      purgeAfter: new Date(
        now.getTime() + this.config.deletedRetentionDays * 86_400_000,
      ),
    })
    if (!owned) return "LOST"
    this.activity.metrics.media.processed.inc({
      type: row.type,
      outcome: "failed",
    })
    this.activity.emit(MediaEvent.FAILED, row.publicId, {
      mediaId: row.publicId,
      propertyId: row.property?.publicId ?? null,
      purpose: row.purpose,
      reason: code,
    })
    this.activity.log("media.failed", null, {
      media_id: row.publicId,
      type: row.type,
      attempt: job.attempt,
      code,
    })
    return "FAILED"
  }
}

class LostLeaseError extends Error {}

const sha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex")

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new MediaProcessingError("PROCESSING_TIMEOUT", false)),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
