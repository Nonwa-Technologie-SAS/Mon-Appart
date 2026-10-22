import { randomUUID } from "node:crypto"

import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client"

import { requirePublisher } from "@/lib/api-auth"
import { corsPreflight, withCors } from "@/lib/cors"
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  UploadError,
  blobStoreIdFromToken,
} from "@/lib/uploads"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(request: Request) {
  const { response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return withCors(
      request,
      Response.json(
        { error: "Stockage Blob non configuré. Ajoutez BLOB_READ_WRITE_TOKEN." },
        { status: 500 }
      )
    )
  }

  let body: { filename?: string; contentType?: string }
  try {
    body = (await request.json()) as { filename?: string; contentType?: string }
  } catch {
    return withCors(
      request,
      Response.json({ error: "Requête invalide" }, { status: 400 })
    )
  }

  const contentType = body.contentType?.toLowerCase() ?? "image/jpeg"
  if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return withCors(
      request,
      Response.json({ error: "Format d'image non supporté (jpg, png, webp)" }, { status: 400 })
    )
  }

  const filename = (body.filename ?? "photo.jpg")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80)
  const pathname = `properties/${randomUUID()}-${filename}`
  const storeId = blobStoreIdFromToken()

  try {
    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
      maximumSizeInBytes: MAX_IMAGE_SIZE,
      addRandomSuffix: true,
    })

    return withCors(
      request,
      Response.json({
        token,
        pathname,
        storeId,
        apiUrl: "https://vercel.com/api/blob",
      })
    )
  } catch (error) {
    const message =
      error instanceof UploadError
        ? error.message
        : "Impossible de préparer l’upload"
    return withCors(request, Response.json({ error: message }, { status: 400 }))
  }
}
