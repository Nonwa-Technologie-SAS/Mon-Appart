import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createHmac } from "node:crypto"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import type { MediaLimits } from "./domain/media-policy"

export type MediaStorageKind = "local" | "s3" | "r2"

/** Configuration Media, lue une fois depuis l'environnement validé. */
@Injectable()
export class MediaConfig {
  readonly storage: MediaStorageKind
  readonly production: boolean
  readonly limits: MediaLimits
  readonly uploadUrlTtlSeconds: number
  readonly downloadUrlTtlSeconds: number
  readonly worker: {
    enabled: boolean
    pollMs: number
    concurrency: number
    maxAttempts: number
    timeoutMs: number
    cleanupIntervalMs: number
  }
  readonly deletedRetentionDays: number
  readonly local: {
    root: string
    baseUrl: string
    /** Clé HMAC des liens locaux, dérivée : jamais exposée ni journalisée. */
    signingKey: Buffer
  }
  readonly s3: {
    endpoint: string | null
    region: string
    bucket: string
    publicBucket: string | null
    publicBaseUrl: string | null
    accessKeyId: string
    secretAccessKey: string
    forcePathStyle: boolean
  }

  constructor(config: ConfigService) {
    const str = (key: string, fallback = "") => {
      const value = config.get<string | number>(key)
      return value === undefined || value === "" ? fallback : String(value)
    }
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }

    const storage = str("MEDIA_STORAGE_PROVIDER", "local")
    this.storage = storage === "s3" || storage === "r2" ? storage : "local"
    const appEnv = str("APP_ENV", "local")
    this.production = appEnv === "production" || appEnv === "staging"
    this.limits = {
      imageBytes: num("MEDIA_MAX_IMAGE_BYTES", 15 * 1024 * 1024),
      videoBytes: num("MEDIA_MAX_VIDEO_BYTES", 200 * 1024 * 1024),
      documentBytes: num("MEDIA_MAX_DOCUMENT_BYTES", 20 * 1024 * 1024),
      imagePixels: num("MEDIA_MAX_IMAGE_PIXELS", 50_000_000),
      videoSeconds: num("MEDIA_MAX_VIDEO_SECONDS", 180),
      perProperty: num("MEDIA_MAX_PER_PROPERTY", 30),
      pendingUploads: num("MEDIA_MAX_PENDING_UPLOADS", 20),
    }
    this.uploadUrlTtlSeconds = num("MEDIA_UPLOAD_URL_TTL_SECONDS", 900)
    this.downloadUrlTtlSeconds = num("MEDIA_DOWNLOAD_URL_TTL_SECONDS", 300)
    this.worker = {
      enabled: str("MEDIA_WORKER_ENABLED", "true") === "true",
      pollMs: num("MEDIA_WORKER_POLL_MS", 2_000),
      concurrency: num("MEDIA_WORKER_CONCURRENCY", 2),
      maxAttempts: num("MEDIA_JOB_MAX_ATTEMPTS", 5),
      timeoutMs: num("MEDIA_JOB_TIMEOUT_MS", 60_000),
      cleanupIntervalMs: num("MEDIA_CLEANUP_INTERVAL_MINUTES", 15) * 60_000,
    }
    this.deletedRetentionDays = num("MEDIA_DELETED_RETENTION_DAYS", 30)

    const port = num("APP_PORT", 4000)
    this.local = {
      root: resolve(
        str("MEDIA_LOCAL_ROOT") || join(tmpdir(), "mon-appart-media"),
      ),
      baseUrl: str("MEDIA_LOCAL_BASE_URL", `http://localhost:${port}`).replace(
        /\/+$/,
        "",
      ),
      signingKey: createHmac("sha256", str("JWT_SECRET"))
        .update("mon-appart:media-local-storage:v1")
        .digest(),
    }
    const publicBucket = str("S3_PUBLIC_BUCKET")
    this.s3 = {
      endpoint: str("S3_ENDPOINT") || null,
      region: str("S3_REGION", "auto"),
      bucket: str("S3_BUCKET"),
      publicBucket: publicBucket || null,
      publicBaseUrl: str("MEDIA_PUBLIC_BASE_URL").replace(/\/+$/, "") || null,
      accessKeyId: str("S3_ACCESS_KEY"),
      secretAccessKey: str("S3_SECRET_KEY"),
      forcePathStyle: str("S3_FORCE_PATH_STYLE", "false") === "true",
    }
  }
}

/** Limites par minute et par IP, lues à la requête par le ThrottlerGuard. */
export const mediaUploadRateLimit = (): number =>
  Number(process.env.MEDIA_UPLOAD_RATE_LIMIT) || 30
export const mediaMutationRateLimit = (): number =>
  Number(process.env.MEDIA_MUTATION_RATE_LIMIT) || 60
