import { isPublisherRole, type WebSession } from "@/lib/auth-session"
import {
  nestServerMe,
  nestServerRefresh,
  nestUserToSession,
} from "@/lib/nest-session"

/**
 * Auth pour les Route Handlers Next (blob, etc.) via Nest.
 * Lit le cookie ma_access ou tente un refresh avec les cookies de la requête.
 */
export async function getRequestSession(
  request: Request,
): Promise<WebSession | null> {
  const cookie = request.headers.get("cookie") ?? ""
  const accessMatch = cookie.match(/(?:^|;\s*)ma_access=([^;]+)/)
  let token = accessMatch?.[1]
    ? decodeURIComponent(accessMatch[1])
    : null

  if (!token) {
    const csrfMatch = cookie.match(/(?:^|;\s*)ma_csrf=([^;]+)/)
    const csrf = csrfMatch?.[1]
      ? decodeURIComponent(csrfMatch[1])
      : null
    if (!csrf || !cookie.includes("ma_refresh=")) return null

    const nestOrigin = (
      process.env.NEST_API_URL?.trim() || "http://localhost:4000"
    ).replace(/\/+$/, "")
    const refresh = await fetch(`${nestOrigin}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        Cookie: cookie,
      },
      body: "{}",
      cache: "no-store",
    })
    if (!refresh.ok) return null
    const body = (await refresh.json()) as { accessToken?: string }
    token = body.accessToken ?? null
  }

  if (!token) {
    token = await nestServerRefresh()
  }
  if (!token) return null

  const user = await nestServerMe(token)
  if (!user) return null
  return nestUserToSession(user)
}

export async function requirePublisher(request: Request) {
  const session = await getRequestSession(request)

  if (!session) {
    return {
      session: null,
      response: Response.json({ error: "Connexion requise" }, { status: 401 }),
    }
  }

  if (!isPublisherRole(session.user.role)) {
    return {
      session: null,
      response: Response.json(
        { error: "Seuls les propriétaires peuvent publier un bien" },
        { status: 403 },
      ),
    }
  }

  return { session, response: null }
}
