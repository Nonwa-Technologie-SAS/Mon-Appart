import {
  corsPreflight,
  withCors,
} from "@/lib/cors"
import { requirePublisher } from "@/lib/api-auth"
import { listPropertiesByUserId } from "@/lib/properties"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(request: Request) {
  const { session, response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

  const properties = await listPropertiesByUserId(session.user.id)
  return withCors(
    request,
    Response.json({
      data: properties,
      count: properties.length,
    })
  )
}
