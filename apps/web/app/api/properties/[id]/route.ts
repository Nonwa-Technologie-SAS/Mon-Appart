import { getRequestSession, requirePublisher } from "@/lib/api-auth"
import { nestGetListing } from "@/lib/nest-listings"
import { nestUpdateListingVisibility } from "@/lib/nest-publish"
import { PropertyStatus } from "@/lib/domain-enums"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params
  const session = await getRequestSession(request)
  const listing = await nestGetListing(id)
  if (!listing) {
    return Response.json({ error: "Annonce introuvable" }, { status: 404 })
  }

  return Response.json({
    ...listing,
    isOwner: Boolean(session?.user.id),
  })
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requirePublisher(request)
  if (auth.response) return auth.response

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const status = (body as { status?: string }).status
  if (status !== "AVAILABLE" && status !== "ARCHIVED") {
    return Response.json({ error: "Statut invalide" }, { status: 400 })
  }

  try {
    await nestUpdateListingVisibility(id, status === PropertyStatus.AVAILABLE)
    return Response.json({ id, status })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Mise à jour impossible",
      },
      { status: 502 },
    )
  }
}
