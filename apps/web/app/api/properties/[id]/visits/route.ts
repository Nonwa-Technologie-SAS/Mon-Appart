import { nestServerFetch } from "@/lib/nest-session"
import { getRequestSession } from "@/lib/api-auth"
import { normalizeWhatsapp } from "@/lib/visits"

type Ctx = { params: Promise<{ id: string }> }

/** Demande de visite → Nest appointments. */
export async function POST(request: Request, context: Ctx) {
  const session = await getRequestSession(request)
  if (!session) {
    return Response.json({ error: "Connexion requise" }, { status: 401 })
  }

  const { id: listingId } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const input = body as {
    visitAt?: string
    whatsapp?: string
    visitorName?: string
    visitorEmail?: string
  }

  const whatsapp = input.whatsapp
    ? normalizeWhatsapp(input.whatsapp)
    : null
  if (!input.visitAt) {
    return Response.json({ error: "Date requise" }, { status: 400 })
  }

  try {
    const appointment = await nestServerFetch("/appointments", {
      method: "POST",
      body: {
        listingId,
        scheduledAt: new Date(input.visitAt).toISOString(),
        timezone: "Africa/Abidjan",
        notes: [
          whatsapp ? `WhatsApp: ${whatsapp}` : null,
          input.visitorName,
          input.visitorEmail,
        ]
          .filter(Boolean)
          .join(" — "),
      },
    })
    return Response.json(appointment, { status: 201 })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Demande impossible",
      },
      { status: 502 },
    )
  }
}
