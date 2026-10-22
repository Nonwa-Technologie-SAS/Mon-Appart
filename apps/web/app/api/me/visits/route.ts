import { requirePublisher } from "@/lib/api-auth"
import { listNestAppointments } from "@/lib/nest-appointments"

export async function GET(request: Request) {
  const auth = await requirePublisher(request)
  if (auth.response) return auth.response

  try {
    const items = await listNestAppointments()
    return Response.json({ items })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Visites indisponibles",
      },
      { status: 502 },
    )
  }
}
