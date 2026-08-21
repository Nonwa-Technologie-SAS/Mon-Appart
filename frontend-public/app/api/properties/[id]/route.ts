import { getRequestSession, requirePublisher } from "@/lib/api-auth"
import {
  corsPreflight,
  withCors,
} from "@/lib/cors"
import {
  firstZodError,
  updatePropertyStatusSchema,
} from "@/lib/auth-schemas"
import {
  getAvailablePropertyById,
  updateOwnedPropertyStatus,
} from "@/lib/properties"
import { MediaType, Role } from "@/prisma/generated/client/enums"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getRequestSession(request)
  const property = await getAvailablePropertyById(id, session?.user.id)

  if (!property) {
    return withCors(
      request,
      Response.json({ error: "Not found" }, { status: 404 })
    )
  }

  const images = property.media.filter((media) => media.type === MediaType.IMAGE)
  const virtualTour = property.media.find(
    (media) => media.type === MediaType.VIRTUAL_TOUR
  )

  return withCors(
    request,
    Response.json({
      data: {
        id: property.id,
        title: property.title,
        description: property.description,
        price: property.price,
        type: property.type,
        location: property.location,
        latitude: property.latitude,
        longitude: property.longitude,
        status: property.status,
        imageUrl: images[0]?.url ?? null,
        images: images.map((media) => ({ id: media.id, url: media.url })),
        virtualTourUrl: virtualTour?.url ?? null,
        features: property.features.map((feature) => ({
          id: feature.id,
          name: feature.name,
          value: feature.value,
        })),
        agency: property.agency,
        isOwner: Boolean(session?.user.id && session.user.id === property.userId),
      },
    })
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

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

  const parsed = updatePropertyStatusSchema.safeParse(body)
  if (!parsed.success) {
    return withCors(
      request,
      Response.json({ error: firstZodError(parsed.error) }, { status: 400 })
    )
  }

  const role = session.user.role as Role | undefined
  const asStaff = role === Role.ADMIN || role === Role.SUPERADMIN

  try {
    const property = await updateOwnedPropertyStatus(
      id,
      session.user.id,
      parsed.data.status,
      asStaff
    )

    if (!property) {
      return withCors(
        request,
        Response.json({ error: "Bien introuvable" }, { status: 404 })
      )
    }

    return withCors(request, Response.json({ data: property }))
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return withCors(
        request,
        Response.json({ error: "Vous ne pouvez pas modifier ce bien" }, { status: 403 })
      )
    }
    return withCors(
      request,
      Response.json({ error: "Impossible de mettre à jour le statut" }, { status: 500 })
    )
  }
}
