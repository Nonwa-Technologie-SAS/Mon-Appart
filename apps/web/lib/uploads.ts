import { del, put } from "@vercel/blob"
import { randomUUID } from "node:crypto"

import {
  ALLOWED_IMAGE_TYPES,
  FUNCTION_UPLOAD_MAX,
  MAX_PROPERTY_IMAGES,
} from "@/lib/upload-constants"
import { isVisitRoom, type VisitLayoutItem } from "@/lib/visit-rooms"

export {
  ALLOWED_IMAGE_TYPES,
  FUNCTION_UPLOAD_MAX,
  MAX_IMAGE_SIZE,
  MAX_PROPERTY_IMAGES,
} from "@/lib/upload-constants"

const BLOB_HOST = /\.blob\.vercel-storage\.com$/i

export class UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UploadError"
  }
}

export function isAllowedBlobUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && BLOB_HOST.test(url.hostname)
  } catch {
    return false
  }
}

export function collectImageUrls(form: FormData) {
  return form
    .getAll("imageUrls")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
}

export function normalizeImageUrls(input: unknown) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string" && input
      ? [input]
      : []

  const urls = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)

  if (urls.length > MAX_PROPERTY_IMAGES) {
    throw new UploadError(`Vous pouvez ajouter au plus ${MAX_PROPERTY_IMAGES} photos`)
  }

  for (const url of urls) {
    if (!isAllowedBlobUrl(url)) {
      throw new UploadError("URL d'image invalide")
    }
  }

  return urls
}

export function collectImageLayout(form: FormData): unknown {
  const raw = form.get("imageLayout")
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      throw new UploadError("Disposition des photos invalide")
    }
  }

  return collectImageUrls(form).map((url, index) => ({
    url,
    room: "OTHER",
    sortOrder: index,
  }))
}

export function normalizeImageLayout(input: unknown): VisitLayoutItem[] {
  if (!Array.isArray(input) || input.length === 0) {
    return []
  }

  if (input.every((item) => typeof item === "string")) {
    return normalizeImageUrls(input).map((url, index) => ({
      url,
      room: "OTHER" as const,
      sortOrder: index,
    }))
  }

  const layout = input.flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const record = item as { url?: unknown; room?: unknown; sortOrder?: unknown }
    if (typeof record.url !== "string" || !record.url.trim()) return []
    return [
      {
        url: record.url.trim(),
        room: isVisitRoom(record.room) ? record.room : ("OTHER" as const),
        sortOrder:
          typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
            ? record.sortOrder
            : index,
      },
    ]
  })

  normalizeImageUrls(layout.map((item) => item.url))
  return layout
}

export function blobStoreIdFromToken(token = process.env.BLOB_READ_WRITE_TOKEN) {
  if (!token) return null
  return token.split("_")[3] || null
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)
  return cleaned || "photo.webp"
}

export async function putPropertyImage(file: File) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new UploadError(
      "Stockage Blob non configuré. Ajoutez BLOB_READ_WRITE_TOKEN."
    )
  }

  if (file.size <= 0) {
    throw new UploadError("Fichier image vide")
  }

  if (file.size > FUNCTION_UPLOAD_MAX) {
    throw new UploadError("Cette photo est encore trop lourde après optimisation")
  }

  const type = (file.type || "image/webp").toLowerCase()
  if (
    !ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])
  ) {
    throw new UploadError("Format d'image non supporté (jpg, png, webp)")
  }

  const blob = await put(`properties/${randomUUID()}-${safeFileName(file.name)}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: type,
  })

  return blob.url
}

export async function removePropertyImages(urls: string[]) {
  const blobUrls = urls.filter((url) => /^https?:\/\//i.test(url))
  if (blobUrls.length === 0) return

  await del(blobUrls).catch(() => undefined)
}
