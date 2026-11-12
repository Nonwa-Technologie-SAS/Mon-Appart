/**
 * Envoi de photos d'un bien via les sessions Nest.
 * Le fichier part en PUT vers l'URL signée, puis la session est confirmée.
 * PostgreSQL ne reçoit que les métadonnées.
 */

import { nestServerFetch } from "@/lib/nest-session"

const NEST_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
])

/** Aligné sur MEDIA_MAX_IMAGE_BYTES (15 Mo) tant que l'API n'expose pas la limite. */
export const NEST_MAX_IMAGE_BYTES = 15 * 1024 * 1024

type UploadTarget = {
  url: string
  method: string
  headers: Record<string, string>
  contentLength: number
}

type UploadSession = {
  sessionId: string
  mediaId: string
  upload?: UploadTarget
}

export function nestImageMime(type: string): string | null {
  const normalized = type.trim().toLowerCase()
  if (normalized === "image/jpg") return "image/jpeg"
  return NEST_IMAGE_MIME.has(normalized) ? normalized : null
}

export async function uploadPropertyImagesToNest(
  propertyId: string,
  files: File[],
): Promise<string[]> {
  const mediaIds: string[] = []

  for (const file of files) {
    const mimeType = nestImageMime(file.type)
    if (!mimeType) {
      throw new Error(
        "Format refusé. Nest accepte JPEG, PNG, WebP et AVIF.",
      )
    }
    if (file.size <= 0 || file.size > NEST_MAX_IMAGE_BYTES) {
      throw new Error("Chaque photo doit faire entre 1 octet et 15 Mo.")
    }

    const session = await nestServerFetch<UploadSession>(
      "/media/upload-sessions",
      {
        method: "POST",
        body: {
          propertyId,
          type: "IMAGE",
          mimeType,
          size: file.size,
          filename: file.name,
        },
      },
    )

    const upload = session.upload
    if (!upload || upload.method.toUpperCase() !== "PUT") {
      throw new Error("Session d'envoi inattendue.")
    }
    if (upload.contentLength !== file.size) {
      throw new Error("La taille attendue par le serveur ne correspond pas au fichier.")
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const sent = await fetch(upload.url, {
      method: "PUT",
      headers: upload.headers,
      body: bytes,
    })
    if (!sent.ok) {
      throw new Error("Le stockage a refusé la photo.")
    }

    await nestServerFetch(`/media/upload-sessions/${session.sessionId}/complete`, {
      method: "POST",
    })
    mediaIds.push(session.mediaId)
  }

  if (mediaIds.length > 0) {
    await nestServerFetch(`/properties/${propertyId}/media/order`, {
      method: "PATCH",
      body: { mediaIds },
    })
  }

  return mediaIds
}

export async function publishNestListing(listingId: string): Promise<void> {
  await nestServerFetch(`/listings/${listingId}/publish`, {
    method: "POST",
    body: {},
  })
}
