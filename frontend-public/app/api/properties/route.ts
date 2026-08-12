import {
  corsPreflight,
  withCors,
} from "@/lib/cors"
import { searchAvailableProperties } from "@/lib/properties"

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
