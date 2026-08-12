import {
  corsPreflight,
  withCors,
} from "@/lib/cors"
import { getAvailablePropertyById } from "@/lib/properties"
import { MediaType } from "@/prisma/generated/client/enums"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const property = await getAvailablePropertyById(id)

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
      },
    })
  )
}
