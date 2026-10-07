import { requirePublisher } from "@/lib/api-auth"
import { corsPreflight, withCors } from "@/lib/cors"
import { putPropertyImage, UploadError } from "@/lib/uploads"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(request: Request) {
  const { response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return withCors(
      request,
      Response.json({ error: "Requête invalide" }, { status: 400 })
    )
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return withCors(
      request,
      Response.json({ error: "Aucune photo envoyée" }, { status: 400 })
    )
  }

  try {
    const url = await putPropertyImage(file)
    return withCors(request, Response.json({ url }))
  } catch (error) {
    const message =
      error instanceof UploadError
        ? error.message
        : "Impossible d’envoyer la photo vers le stockage"
    const status = error instanceof UploadError ? 400 : 500
    return withCors(request, Response.json({ error: message }, { status }))
  }
}
