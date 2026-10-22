import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

import { requirePublisher } from "@/lib/api-auth"
import { corsPreflight, withCors } from "@/lib/cors"
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "@/lib/uploads"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(request: Request) {
  const { response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return withCors(
      request,
      Response.json({ error: "Requête invalide" }, { status: 400 })
    )
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("properties/")) {
          throw new Error("Chemin de fichier invalide")
        }

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_SIZE,
          addRandomSuffix: true,
        }
      },
    })

    return withCors(request, Response.json(result))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible d’autoriser l’upload"
    return withCors(request, Response.json({ error: message }, { status: 400 }))
  }
}
