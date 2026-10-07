import { corsPreflight, withCors } from "@/lib/cors"
import { requirePublisher } from "@/lib/api-auth"
import { listVisitsForOwner } from "@/lib/visits"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(request: Request) {
  const { session, response } = await requirePublisher(request)
  if (response) {
    return withCors(request, response)
  }

  const visits = await listVisitsForOwner(session.user.id)
  const pendingCount = visits.filter((visit) => visit.status === "PENDING").length

  return withCors(
    request,
    Response.json({
      data: visits,
      pendingCount,
    })
  )
}
