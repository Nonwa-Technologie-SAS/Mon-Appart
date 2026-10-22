import type {
  MediaStatus,
  MediaType,
  MediaVariantKind,
  MediaVisibility,
} from "../../../generated/prisma/enums"
import { mediaError } from "./media-errors"

/** Liste autorisée par type de média. HEIC, SVG, GIF et TIFF sont refusés. */
export const ALLOWED_MIME_TYPES: Record<MediaType, readonly string[]> = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  IMAGE_360: ["image/jpeg"],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
  DOCUMENT: ["application/pdf", "image/jpeg", "image/png"],
}

const EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "video/mp4": ["mp4", "m4v"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
  "application/pdf": ["pdf"],
}

export interface MediaLimits {
  imageBytes: number
  videoBytes: number
  documentBytes: number
  imagePixels: number
  videoSeconds: number
  perProperty: number
  pendingUploads: number
}

export function maxBytesFor(type: MediaType, limits: MediaLimits): number {
  if (type === "VIDEO") return limits.videoBytes
  if (type === "DOCUMENT") return limits.documentBytes
  return limits.imageBytes
}

export interface UploadDeclaration {
  type: MediaType
  mimeType: string
  size: number
  filename?: string | null
}

/**
 * Contrôle de la déclaration du client avant toute URL d'envoi. Ce n'est
 * qu'un premier filtre : la confirmation relit le fichier réellement stocké.
 */
export function validateDeclaration(
  declaration: UploadDeclaration,
  limits: MediaLimits,
): { mimeType: string } {
  const mimeType = declaration.mimeType.trim().toLowerCase()
  if (!ALLOWED_MIME_TYPES[declaration.type].includes(mimeType)) {
    throw mediaError("UNSUPPORTED_MEDIA_TYPE", declaration.type)
  }
  const max = maxBytesFor(declaration.type, limits)
  if (!Number.isSafeInteger(declaration.size) || declaration.size <= 0) {
    throw mediaError("INVALID_MEDIA_REQUEST", "size")
  }
  if (declaration.size > max) {
    throw mediaError("FILE_TOO_LARGE", `maximum ${max} octets`)
  }
  const extension = extensionOf(declaration.filename)
  if (extension !== null && !EXTENSIONS[mimeType]?.includes(extension)) {
    throw mediaError("UNSUPPORTED_MEDIA_TYPE", "extension")
  }
  return { mimeType }
}

/** Le format détecté doit être celui annoncé et autorisé pour ce type de média. */
export function signatureMatches(
  type: MediaType,
  declaredMime: string,
  detectedMime: string | null,
): boolean {
  return (
    detectedMime !== null &&
    detectedMime === declaredMime &&
    ALLOWED_MIME_TYPES[type].includes(detectedMime)
  )
}

function extensionOf(filename: string | null | undefined): string | null {
  if (!filename) return null
  const base = sanitizeFilename(filename)
  if (!base) return null
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : null
}

/**
 * Nom d'origine conservé à titre informatif : sans chemin, sans caractère de
 * contrôle, 255 caractères au plus. Jamais utilisé pour construire une clé.
 */
export function sanitizeFilename(
  filename: string | null | undefined,
): string | null {
  if (!filename) return null
  const base = filename.split(/[\\/]/).pop() ?? ""
  const cleaned = base
    .normalize("NFC")
    .replace(/[\p{Cc}"<>|*?:]/gu, "")
    .trim()
    .slice(0, 255)
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : null
}

/** Un document est toujours privé ; une image ou vidéo est publique par défaut. */
export function resolveVisibility(
  type: MediaType,
  requested?: MediaVisibility,
): MediaVisibility {
  if (type === "DOCUMENT") return "PRIVATE"
  return requested ?? "PUBLIC"
}

export interface VariantSpec {
  kind: MediaVariantKind
  width: number
  height: number
}

/** Boîtes de redimensionnement (ratio conservé, jamais d'agrandissement). */
export const IMAGE_VARIANTS: readonly VariantSpec[] = [
  { kind: "THUMBNAIL", width: 320, height: 320 },
  { kind: "CARD", width: 640, height: 640 },
  { kind: "GALLERY", width: 1280, height: 1280 },
  { kind: "LARGE", width: 1920, height: 1920 },
]

/** Une photo 360° équirectangulaire garde son ratio 2:1 et une grande largeur. */
export const PANORAMA_VARIANTS: readonly VariantSpec[] = [
  { kind: "THUMBNAIL", width: 640, height: 320 },
  { kind: "CARD", width: 1280, height: 640 },
  { kind: "GALLERY", width: 2560, height: 1280 },
  { kind: "LARGE", width: 4096, height: 2048 },
]

export const variantsFor = (type: MediaType): readonly VariantSpec[] =>
  type === "IMAGE_360" ? PANORAMA_VARIANTS : IMAGE_VARIANTS

/** Tolérance du ratio largeur / hauteur d'une photo 360° équirectangulaire. */
export function isEquirectangular(width: number, height: number): boolean {
  const ratio = width / height
  return ratio >= 1.95 && ratio <= 2.05
}

/** Variante servant d'URL de couverture (`media.url`). */
export const COVER_VARIANT: MediaVariantKind = "CARD"

/** Médias affichables publiquement : prêts, publics, non supprimés. */
export function isPubliclyListable(media: {
  status: MediaStatus
  visibility: MediaVisibility
  deletedAt: Date | null
}): boolean {
  return (
    media.status === "READY" &&
    media.visibility === "PUBLIC" &&
    media.deletedAt === null
  )
}

/** Peut devenir l'image principale : photo (plate ou 360°) affichable. */
export function isPrimaryEligible(media: {
  type: MediaType
  status: MediaStatus
  visibility: MediaVisibility
  deletedAt: Date | null
}): boolean {
  return (
    (media.type === "IMAGE" || media.type === "IMAGE_360") &&
    isPubliclyListable(media)
  )
}
