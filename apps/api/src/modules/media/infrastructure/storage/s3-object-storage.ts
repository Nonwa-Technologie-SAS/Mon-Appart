import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type { StorageProvider } from "../../../../generated/prisma/enums"
import { assertSafeKey } from "../../domain/storage-keys"
import {
  contentDisposition,
  StorageError,
  type BucketScope,
  type DownloadOptions,
  type ListedObject,
  type ObjectInfo,
  type ObjectStorage,
  type UploadTarget,
} from "./object-storage"

export interface S3StorageOptions {
  provider: Extract<StorageProvider, "S3" | "R2">
  endpoint: string | null
  region: string
  bucket: string
  publicBucket: string | null
  publicBaseUrl: string | null
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  /** Délai maximal d'un appel au fournisseur. */
  requestTimeoutMs?: number
}

/**
 * Stockage compatible S3 : Amazon S3 ou Cloudflare R2 (même API). Les
 * identifiants restent côté serveur ; le navigateur ne reçoit que des URL
 * présignées limitées dans le temps.
 */
export class S3ObjectStorage implements ObjectStorage {
  readonly provider: StorageProvider
  readonly hasPublicBucket: boolean
  private readonly client: S3Client

  constructor(private readonly options: S3StorageOptions) {
    this.provider = options.provider
    this.hasPublicBucket = Boolean(
      options.publicBucket && options.publicBaseUrl,
    )
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint ?? undefined,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // Pas de somme de contrôle implicite : elle casserait les URL présignées (R2 inclus).
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 2,
      requestHandler: { requestTimeout: options.requestTimeoutMs ?? 30_000 },
    })
  }

  private bucket(scope: BucketScope): string {
    if (scope === "public") {
      if (!this.options.publicBucket) {
        throw new StorageError("PUBLIC_BUCKET_NOT_CONFIGURED", false)
      }
      return this.options.publicBucket
    }
    return this.options.bucket
  }

  /**
   * Présignature S3/R2. `as never` contourne les doublons `@smithy/*` /
   * `@aws-sdk/*` que pnpm peut installer (Docker filter) : Client et Command
   * ne partagent alors plus le même type `handlers` / middlewareStack.
   */
  private presign(
    command: PutObjectCommand | GetObjectCommand,
    options: {
      expiresIn: number
      signableHeaders?: Set<string>
    },
  ): Promise<string> {
    return getSignedUrl(this.client as never, command as never, options)
  }

  async createUploadTarget(
    key: string,
    options: {
      contentType: string
      contentLength: number
      expiresInSeconds: number
    },
  ): Promise<UploadTarget> {
    const command = new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: assertSafeKey(key),
      ContentType: options.contentType,
      ContentLength: options.contentLength,
      // Écriture conditionnelle : l'URL ne peut ni écraser un objet ni resservir.
      IfNoneMatch: "*",
    })
    const url = await this.call(() =>
      this.presign(command, {
        expiresIn: options.expiresInSeconds,
        signableHeaders: new Set([
          "content-type",
          "content-length",
          "if-none-match",
        ]),
      }),
    )
    return {
      url,
      method: "PUT",
      headers: {
        "Content-Type": options.contentType,
        "If-None-Match": "*",
      },
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1_000),
    }
  }

  async head(scope: BucketScope, key: string): Promise<ObjectInfo | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket(scope),
          Key: assertSafeKey(key),
        }),
      )
      return { size: Number(result.ContentLength ?? 0) }
    } catch (error) {
      if (isNotFound(error)) return null
      throw toStorageError(error)
    }
  }

  async readRange(
    scope: BucketScope,
    key: string,
    start: number,
    length: number,
  ): Promise<Buffer> {
    if (length <= 0) return Buffer.alloc(0)
    return this.call(async () => {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket(scope),
          Key: assertSafeKey(key),
          Range: `bytes=${start}-${start + length - 1}`,
        }),
      )
      return Buffer.from(await result.Body!.transformToByteArray())
    })
  }

  async read(
    scope: BucketScope,
    key: string,
    maxBytes: number,
  ): Promise<Buffer> {
    return this.call(async () => {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket(scope),
          Key: assertSafeKey(key),
        }),
      )
      if (Number(result.ContentLength ?? 0) > maxBytes) {
        result.Body?.transformToByteArray().catch(() => undefined)
        throw new StorageError("OBJECT_TOO_LARGE", false)
      }
      return Buffer.from(await result.Body!.transformToByteArray())
    })
  }

  async write(
    scope: BucketScope,
    key: string,
    body: Buffer,
    options: { contentType: string; cacheControl?: string },
  ): Promise<void> {
    await this.call(() =>
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket(scope),
          Key: assertSafeKey(key),
          Body: body,
          ContentType: options.contentType,
          ContentLength: body.length,
          CacheControl: options.cacheControl,
        }),
      ),
    )
  }

  async copy(
    from: { scope: BucketScope; key: string },
    to: { scope: BucketScope; key: string },
    options: { contentType: string; cacheControl?: string },
  ): Promise<void> {
    await this.call(() =>
      this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket(to.scope),
          Key: assertSafeKey(to.key),
          CopySource: `${this.bucket(from.scope)}/${assertSafeKey(from.key)}`,
          ContentType: options.contentType,
          CacheControl: options.cacheControl,
          MetadataDirective: "REPLACE",
        }),
      ),
    )
  }

  async delete(scope: BucketScope, key: string): Promise<void> {
    await this.call(() =>
      this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket(scope),
          Key: assertSafeKey(key),
        }),
      ),
    )
  }

  publicUrl(key: string): string {
    if (!this.options.publicBaseUrl) {
      throw new StorageError("PUBLIC_BUCKET_NOT_CONFIGURED", false)
    }
    return `${this.options.publicBaseUrl}/${assertSafeKey(key)}`
  }

  createDownloadUrl(
    scope: BucketScope,
    key: string,
    options: DownloadOptions,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket(scope),
      Key: assertSafeKey(key),
      ResponseContentDisposition: contentDisposition(
        options.filename,
        options.inline,
      ),
      ResponseContentType: options.contentType,
    })
    return this.call(() =>
      this.presign(command, {
        expiresIn: options.expiresInSeconds,
      }),
    )
  }

  async list(
    scope: BucketScope,
    prefix: string,
    cursor?: string,
  ): Promise<{ objects: ListedObject[]; nextCursor: string | null }> {
    const result = await this.call(() =>
      this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket(scope),
          Prefix: prefix,
          ContinuationToken: cursor,
          MaxKeys: 1_000,
        }),
      ),
    )
    return {
      objects: (result.Contents ?? []).flatMap((item) =>
        item.Key
          ? [
              {
                key: item.Key,
                size: Number(item.Size ?? 0),
                lastModified: item.LastModified ?? new Date(0),
              },
            ]
          : [],
      ),
      nextCursor: result.IsTruncated
        ? (result.NextContinuationToken ?? null)
        : null,
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.options.bucket }),
      )
      return true
    } catch {
      return false
    }
  }

  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      throw toStorageError(error)
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      error.$metadata.httpStatusCode === 404)
  )
}

/** Ne conserve que le nom de l'erreur : le message peut citer la requête signée. */
function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  if (error instanceof S3ServiceException) {
    const status = error.$metadata.httpStatusCode ?? 0
    return new StorageError(
      `S3_${error.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`.slice(
        0,
        60,
      ),
      status === 0 || status >= 500 || status === 429,
    )
  }
  return new StorageError("STORAGE_NETWORK_ERROR", true)
}
