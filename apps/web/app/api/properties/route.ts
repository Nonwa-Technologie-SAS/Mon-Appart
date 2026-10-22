import { requirePublisher } from "@/lib/api-auth"
import { nestSearchListings } from "@/lib/nest-listings"
import { nestPublishListing } from "@/lib/nest-publish"

/** Recherche publique via Nest Search. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  try {
    const items = await nestSearchListings({
      q: searchParams.get("q") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      lat: searchParams.get("lat") ?? undefined,
      lng: searchParams.get("lng") ?? undefined,
    })
    return Response.json({ items })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Recherche indisponible",
      },
      { status: 502 },
    )
  }
}

/** Publication via Nest (property → listing → publish). */
export async function POST(request: Request) {
  const auth = await requirePublisher(request)
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const input = body as {
    title?: string
    description?: string
    price?: number
    type?: string
    location?: string
    beds?: string
    baths?: string
    surface?: string
  }

  if (
    !input.title ||
    !input.description ||
    input.price == null ||
    !input.type ||
    !input.location
  ) {
    return Response.json({ error: "Champs requis manquants" }, { status: 400 })
  }

  try {
    const result = await nestPublishListing({
      title: input.title,
      description: input.description,
      price: Number(input.price),
      type: input.type,
      location: input.location,
      beds: input.beds,
      baths: input.baths,
      surface: input.surface,
    })
    return Response.json(result, { status: 201 })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Publication impossible",
      },
      { status: 502 },
    )
  }
}
