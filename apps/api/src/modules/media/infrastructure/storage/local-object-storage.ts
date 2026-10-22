import { createHmac, timingSafeEqual } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import {
  copyFile,
  link,
  mkdir,
  open,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { Transform, type Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

import type { StorageProvider } from "../../../../generated/prisma/enums"
import { mediaError } from "../../domain/media-errors"
import { assertSafeKey, isSafeKey } from "../../domain/storage-keys"
import {
  contentDisposition,
  type BucketScope,
  type DownloadOptions,
  type ListedObject,
  type ObjectInfo,
  type ObjectStorage,
  type UploadTarget,
} from "./object-storage"

export interface LocalStorageOptions {
  root: string
  /** URL publique de l'API (sans `/api/v1`). */
  baseUrl: string
  signingKey: Buffer
}

interface UploadClaims {
  op: "put"
  k: string
  n: number
  t: string
  e: number
}

interface DownloadClaims {
  op: "get"
  s: BucketScope
  k: string
  t: string
  f?: string
  i?: 1
  e: number
}

type Claims = UploadClaims | DownloadClaims

export const LOCAL_ROUTES = {
  upload: "/api/v1/media/local/uploads/",
  download: "/api/v1/media/local/downloads/",
  public: "/api/v1/media/local/public/",
} as const

/**
 * Stockage sur disque pour le développement et les tests, refusé en
 * production par la validation de configuration. Reproduit les garanties du
 * stockage S3 : liens d'envoi signés (HMAC) limités en clé, type, taille et
 * durée ; aucune écriture par-dessus un objet existant ; espaces privé et
 * public séparés.
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly provider: StorageProvider = "LOCAL"
  readonly hasPublicBucket = true
  private readonly root: string

  constructor(private readonly options: LocalStorageOptions) {
    this.root = resolve(options.root)
  }

  async createUploadTarget(
    key: string,
    options: {
      contentType: string
      contentLength: number
      expiresInSeconds: number
    },
  ): Promise<UploadTarget> {
    const expires = Math.floor(Date.now() / 1_000) + options.expiresInSeconds
    const token = this.sign({
      op: "put",
      k: assertSafeKey(key),
      n: options.contentLength,
      t: options.contentType,
      e: expires,
    })
    return {
      url: `${this.options.baseUrl}${LOCAL_ROUTES.upload}${token}`,
      method: "PUT",
      headers: { "Content-Type": options.contentType },
      expiresAt: new Date(expires * 1_000),
    }
  }

  /**
   * Reçoit l'envoi d'un lien signé : type exact, taille exacte, écriture
   * exclusive (un second envoi sur la même clé échoue en 412).
   */
  async receiveUpload(
    token: string,
    contentType: string | undefined,
    declaredLength: string | undefined,
    body: Readable,
  ): Promise<void> {
    const claims = this.verify(token)
    if (claims?.op !== "put") throw mediaError("INVALID_UPLOAD_TOKEN")
    if ((contentType ?? "").split(";")[0]!.trim().toLowerCase() !== claims.t) {
      throw mediaError("UPLOAD_CONTENT_MISMATCH", "Content-Type")
    }
    if (declaredLength !== undefined && Number(declaredLength) !== claims.n) {
      throw mediaError("UPLOAD_SIZE_MISMATCH")
    }
    const target = this.path("private", claims.k)
    if (await exists(target)) throw mediaError("UPLOAD_ALREADY_RECEIVED")
    await mkdir(dirname(target), { recursive: true })
    const partial = `${target}.part`
    let received = 0
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        if (received > claims.n) {
          callback(mediaError("FILE_TOO_LARGE"))
          return
        }
        callback(null, chunk)
      },
    })
    try {
      await pipeline(body, limit, createWriteStream(partial, { flags: "wx" }))
    } catch (error) {
      await rm(partial, { force: true })
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw mediaError("UPLOAD_ALREADY_RECEIVED")
      }
      throw error
    }
    if (received !== claims.n) {
      await rm(partial, { force: true })
      throw mediaError("UPLOAD_SIZE_MISMATCH")
    }
    try {
      // `link` échoue si la cible existe : jamais d'écrasement.
      await link(partial, target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw mediaError("UPLOAD_ALREADY_RECEIVED")
      }
      throw error
    } finally {
      await rm(partial, { force: true })
    }
  }

  /** Lien de téléchargement signé : chemin du fichier et en-têtes à renvoyer. */
  async openDownload(token: string): Promise<{
    stream: Readable
    size: number
    contentType: string
    disposition: string
  }> {
    const claims = this.verify(token)
    if (claims?.op !== "get") throw mediaError("INVALID_UPLOAD_TOKEN")
    const path = this.path(claims.s, claims.k)
    const info = await stat(path).catch(() => null)
    if (!info) throw mediaError("MEDIA_NOT_FOUND")
    return {
      stream: createReadStream(path),
      size: info.size,
      contentType: claims.t,
      disposition: contentDisposition(claims.f, claims.i === 1),
    }
  }

  /** Variante publique : seules les clés `v/...` de l'espace public sont servies. */
  async openPublic(
    key: string,
  ): Promise<{ stream: Readable; size: number } | null> {
    if (!isSafeKey(key) || !key.startsWith("v/")) return null
    const path = this.path("public", key)
    const info = await stat(path).catch(() => null)
    if (!info) return null
    return { stream: createReadStream(path), size: info.size }
  }

  async head(scope: BucketScope, key: string): Promise<ObjectInfo | null> {
    const info = await stat(this.path(scope, key)).catch(() => null)
    return info?.isFile() ? { size: info.size } : null
  }

  async readRange(
    scope: BucketScope,
    key: string,
    start: number,
    length: number,
  ): Promise<Buffer> {
    if (length <= 0) return Buffer.alloc(0)
    const handle = await open(this.path(scope, key), "r")
    try {
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, start)
      return buffer.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  }

  async read(
    scope: BucketScope,
    key: string,
    maxBytes: number,
  ): Promise<Buffer> {
    const path = this.path(scope, key)
    const info = await stat(path)
    if (info.size > maxBytes) throw new Error("OBJECT_TOO_LARGE")
    return this.readRange(scope, key, 0, info.size)
  }

  async write(
    scope: BucketScope,
    key: string,
    body: Buffer,
    _options?: { contentType: string; cacheControl?: string },
  ): Promise<void> {
    const path = this.path(scope, key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
  }

  async copy(
    from: { scope: BucketScope; key: string },
    to: { scope: BucketScope; key: string },
  ): Promise<void> {
    const target = this.path(to.scope, to.key)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(this.path(from.scope, from.key), target)
  }

  async delete(scope: BucketScope, key: string): Promise<void> {
    await unlink(this.path(scope, key)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error
      },
    )
  }

  publicUrl(key: string): string {
    return `${this.options.baseUrl}${LOCAL_ROUTES.public}${assertSafeKey(key).slice(2)}`
  }

  async createDownloadUrl(
    scope: BucketScope,
    key: string,
    options: DownloadOptions,
  ): Promise<string> {
    const token = this.sign({
      op: "get",
      s: scope,
      k: assertSafeKey(key),
      t: options.contentType,
      f: options.filename,
      i: options.inline ? 1 : undefined,
      e: Math.floor(Date.now() / 1_000) + options.expiresInSeconds,
    })
    return `${this.options.baseUrl}${LOCAL_ROUTES.download}${token}`
  }

  async list(
    scope: BucketScope,
    prefix: string,
  ): Promise<{ objects: ListedObject[]; nextCursor: string | null }> {
    const base = join(this.root, scope)
    const objects: ListedObject[] = []
    const walk = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(
        () => [],
      )
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
          continue
        }
        const key = relative(base, full).split(sep).join("/")
        if (!key.startsWith(prefix) || key.endsWith(".part")) continue
        const info = await stat(full)
        objects.push({ key, size: info.size, lastModified: info.mtime })
      }
    }
    await walk(base)
    return { objects, nextCursor: null }
  }

  async ping(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  /** Chemin absolu confiné à la racine : la clé est validée puis le résultat revérifié. */
  private path(scope: BucketScope, key: string): string {
    const base = join(this.root, scope)
    const full = resolve(base, ...assertSafeKey(key).split("/"))
    if (!full.startsWith(base + sep)) throw new Error("Clé hors du stockage")
    return full
  }

  private sign(claims: Claims): string {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
    return `${payload}.${this.mac(payload)}`
  }

  private verify(token: string): Claims | null {
    const [payload, signature, extra] = token.split(".")
    if (!payload || !signature || extra !== undefined) return null
    const expected = Buffer.from(this.mac(payload))
    const given = Buffer.from(signature)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null
    }
    try {
      const claims = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as Claims
      if (typeof claims.e !== "number" || claims.e * 1_000 < Date.now()) {
        return null
      }
      if (typeof claims.k !== "string" || !isSafeKey(claims.k)) return null
      return claims
    } catch {
      return null
    }
  }

  private mac(payload: string): string {
    return createHmac("sha256", this.options.signingKey)
      .update(payload)
      .digest("base64url")
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}
