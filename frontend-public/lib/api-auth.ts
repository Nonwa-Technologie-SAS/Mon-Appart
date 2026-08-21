import { auth } from "@/lib/auth"
import { isPublisherRole } from "@/lib/auth-session"
import { Role } from "@/prisma/generated/client/enums"

export async function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

export async function requirePublisher(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return {
      session: null,
      response: Response.json({ error: "Connexion requise" }, { status: 401 }),
    }
  }

  const role = session.user.role as Role | undefined
  if (!isPublisherRole(role)) {
    return {
      session: null,
      response: Response.json(
        { error: "Seuls les propriétaires peuvent publier un bien" },
        { status: 403 }
      ),
    }
  }

  return { session, response: null }
}
