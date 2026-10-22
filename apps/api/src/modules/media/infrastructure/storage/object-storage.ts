import type { StorageProvider } from "../../../../generated/prisma/enums"

/**
 * `private` : originaux, documents, quarantaine ; lecture par URL présignée
 * courte. `public` : variantes traitées des médias publics (CDN).
 */
export type BucketScope = "private" | "public"

export interface ObjectInfo {
  size: number
}

export interface UploadTarget {
  url: string
  method: "PUT"
  /** En-têtes que le client doit envoyer tels quels : ils sont signés. */
  headers: Record<string, string>
  expiresAt: Date
}

export interface DownloadOptions {
  expiresInSeconds: number
  contentType: string
  filename?: string
  /** Affichage dans la page (variantes d'images) plutôt que téléchargement. */
  inline?: boolean
}

export interface ListedObject {
  key: string
  size: number
  lastModified: Date
}

/**
 * Abstraction du stockage objet. Les implémentations ne journalisent jamais
 * d'URL signée ni d'identifiant du fournisseur, et ne renvoient au navigateur
 * que des URL limitées dans le temps (sauf variantes du bucket public).
 */
export interface ObjectStorage {
  readonly provider: StorageProvider
  /** Un espace public (CDN) est configuré pour les variantes publiques. */
  readonly hasPublicBucket: boolean

  /** URL d'envoi direct, limitée à une clé, un type, une taille exacte et une durée, sans écrasement. */
  createUploadTarget(
    key: string,
    options: {
      contentType: string
      contentLength: number
      expiresInSeconds: number
    },
  ): Promise<UploadTarget>
  head(scope: BucketScope, key: string): Promise<ObjectInfo | null>
  readRange(
    scope: BucketScope,
    key: string,
    start: number,
    length: number,
  ): Promise<Buffer>
  /** Lit l'objet entier ; refuse au-delà de `maxBytes`. */
  read(scope: BucketScope, key: string, maxBytes: number): Promise<Buffer>
  write(
    scope: BucketScope,
    key: string,
    body: Buffer,
    options: { contentType: string; cacheControl?: string },
  ): Promise<void>
  /** Copie côté fournisseur, sans transiter par l'API. */
  copy(
    from: { scope: BucketScope; key: string },
    to: { scope: BucketScope; key: string },
    options: { contentType: string; cacheControl?: string },
  ): Promise<void>
  /** Idempotent : un objet absent n'est pas une erreur. */
  delete(scope: BucketScope, key: string): Promise<void>
  /** URL permanente d'une variante du bucket public. */
  publicUrl(key: string): string
  /** URL de lecture présignée courte ; téléchargement (`attachment`) sauf `inline`. */
  createDownloadUrl(
    scope: BucketScope,
    key: string,
    options: DownloadOptions,
  ): Promise<string>
  list(
    scope: BucketScope,
    prefix: string,
    cursor?: string,
  ): Promise<{ objects: ListedObject[]; nextCursor: string | null }>
  ping(): Promise<boolean>
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE")

/** Erreur du fournisseur : passagère (réseau, 5xx) ou définitive. */
export class StorageError extends Error {
  constructor(
    readonly code: string,
    readonly transient: boolean,
  ) {
    super(code)
    this.name = "StorageError"
  }
}

/** Nom de fichier sûr pour l'en-tête Content-Disposition. */
export function contentDisposition(filename?: string, inline = false): string {
  const type = inline ? "inline" : "attachment"
  if (!filename) return type
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
