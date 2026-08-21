import { randomUUID } from "node:crypto"

import { requirePublisher } from "@/lib/api-auth"
import {
  createPropertySchema,
  firstZodError,
} from "@/lib/auth-schemas"
import {
  corsPreflight,
  withCors,
} from "@/lib/cors"
import { GeocodeError } from "@/lib/geocode"
import { createPropertyForUser, searchAvailableProperties } from "@/lib/properties"
import {
  collectImageLayout,
  collectImageUrls,
  normalizeImageLayout,
  removePropertyImages,
  UploadError,
} from "@/lib/uploads"

export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const properties = await searchAvailableProperties({
    q: searchParams.get("q") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    maxPrice: searchParams.get("maxPrice") ?? undefined,
    lat: searchParams.get("lat") ?? undefined,
    lng: searchParams.get("lng") ?? undefined,
  })

  return withCors(
    request,
    Response.json({
      data: properties,
      count: properties.length,
    })
  )
}

async function parseCreatePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    return {
      title: form.get("title"),
      description: form.get("description"),
      price: form.get("price"),
      type: form.get("type"),
      location: form.get("location"),
      latitude: form.get("latitude") || undefined,
      longitude: form.get("longitude") || undefined,
      beds: form.get("beds") || undefined,
      baths: form.get("baths") || undefined,
      surface: form.get("surface") || undefined,
      status: form.get("status") || undefined,
      publish: form.get("publish") !== "false",
      imageLayout: collectImageLayout(form),
      imageUrls: collectImageUrls(form),
    }
  }

  return request.json()
}

export async function POST(request: Request) {
  const { session, response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

  let fields: unknown
  try {
    fields = await parseCreatePayload(request)
  } catch {
    return withCors(
      request,
      Response.json({ error: "Requête invalide" }, { status: 400 })
    )
  }

  const parsed = createPropertySchema.safeParse(fields)
  if (!parsed.success) {
    return withCors(
      request,
      Response.json({ error: firstZodError(parsed.error) }, { status: 400 })
    )
  }

  let imageUrls: string[] = []

  try {
    const imageLayout = normalizeImageLayout(
      parsed.data.imageLayout && parsed.data.imageLayout.length > 0
        ? parsed.data.imageLayout
        : parsed.data.imageUrls ?? (parsed.data.imageUrl ? [parsed.data.imageUrl] : [])
    )
    imageUrls = imageLayout.map((item) => item.url)

    const property = await createPropertyForUser(
      session.user.id,
      session.user.agencyId,
      {
        ...parsed.data,
        imageUrl: undefined,
        imageUrls: undefined,
        imageLayout,
      },
      randomUUID()
    )

    return withCors(
      request,
      Response.json({ data: property }, { status: 201 })
    )
  } catch (error) {
    await removePropertyImages(imageUrls)
    const known = error instanceof UploadError || error instanceof GeocodeError
    const message = known ? error.message : "Impossible de publier le bien"
    const status = known ? 400 : 500
    return withCors(
      request,
      Response.json({ error: message }, { status })
    )
  }
}
