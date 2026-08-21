import { corsPreflight, withCors } from "@/lib/cors"
import { firstZodError, createVisitSchema } from "@/lib/auth-schemas"
import {
  createVisitForProperty,
  normalizeWhatsapp,
} from "@/lib/visits"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return withCors(
      request,
      Response.json({ error: "JSON invalide" }, { status: 400 })
    )
  }

  const parsed = createVisitSchema.safeParse(body)
  if (!parsed.success) {
    return withCors(
      request,
      Response.json({ error: firstZodError(parsed.error) }, { status: 400 })
    )
  }

  const whatsapp = normalizeWhatsapp(parsed.data.whatsapp)
  if (!whatsapp) {
    return withCors(
      request,
      Response.json(
        { error: "Indiquez un numéro WhatsApp valide" },
        { status: 400 }
      )
    )
  }

  const visitAt = parsed.data.visitAt
  if (Number.isNaN(visitAt.getTime())) {
    return withCors(
      request,
      Response.json({ error: "Date de visite invalide" }, { status: 400 })
    )
  }

  const now = new Date()
  if (visitAt.getTime() < now.getTime() - 60_000) {
    return withCors(
      request,
      Response.json(
        { error: "Choisissez une date et une heure à venir" },
        { status: 400 }
      )
    )
  }

  const visit = await createVisitForProperty(
    id,
    {
      visitAt,
      whatsapp,
      visitorName: parsed.data.visitorName,
      visitorEmail: parsed.data.visitorEmail,
    },
    null
  )

  if (!visit) {
    return withCors(
      request,
      Response.json({ error: "Bien introuvable" }, { status: 404 })
    )
  }

  return withCors(
    request,
    Response.json({ data: visit }, { status: 201 })
  )
}
