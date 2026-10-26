import {
  addVerificationDocument,
  completeMediaUpload,
  type VerificationDocumentType,
} from "@/lib/nest-trust"
import { getRequestSession } from "@/lib/api-auth"

type Ctx = { params: Promise<{ id: string }> }

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

/** Proxy d’upload : évite les soucis CORS navigateur → stockage Nest. */
export async function POST(request: Request, context: Ctx) {
  const session = await getRequestSession(request)
  if (!session) {
    return Response.json({ error: "Connexion requise" }, { status: 401 })
  }

  const { id: verificationId } = await context.params
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Formulaire invalide" }, { status: 400 })
  }

  const documentType = String(form.get("documentType") ?? "") as VerificationDocumentType
  const file = form.get("file")
  if (!documentType || !(file instanceof File)) {
    return Response.json(
      { error: "Type de pièce et fichier requis" },
      { status: 400 },
    )
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { error: "Formats acceptés : PDF, JPEG, PNG, WebP" },
      { status: 400 },
    )
  }
  if (file.size < 1 || file.size > 12_000_000) {
    return Response.json(
      { error: "Fichier trop petit ou trop volumineux (max 12 Mo)" },
      { status: 400 },
    )
  }

  try {
    const opened = await addVerificationDocument(verificationId, {
      documentType,
      mimeType: file.type,
      size: file.size,
      filename: file.name,
    })
    const target = opened.upload.upload
    if (!target?.url) {
      return Response.json(
        { error: "Session d’envoi incomplète" },
        { status: 502 },
      )
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const put = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: bytes,
    })
    if (!put.ok) {
      return Response.json(
        { error: `Échec de l’envoi du fichier (${put.status})` },
        { status: 502 },
      )
    }

    await completeMediaUpload(opened.upload.sessionId)
    return Response.json(
      { documentId: opened.documentId, sessionId: opened.upload.sessionId },
      { status: 201 },
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Upload impossible",
      },
      { status: 502 },
    )
  }
}
