import { requirePublisher } from "@/lib/api-auth"
import { listPropertiesByUserId } from "@/lib/properties"

export async function GET(request: Request) {
  const auth = await requirePublisher(request)
  if (auth.response) return auth.response

  try {
    const properties = await listPropertiesByUserId(auth.session!.user.id)
    return Response.json({ items: properties })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Liste indisponible",
      },
      { status: 502 },
    )
  }
}
