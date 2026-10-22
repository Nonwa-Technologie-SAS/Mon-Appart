import { nestApiUrl } from "@/lib/nest-url"

/**
 * Inscription propriétaire → Nest register (CUSTOMER).
 * Élévation OWNER via admin Nest.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const payload = body as {
    name?: string
    email?: string
    password?: string
  }

  if (!payload.email || !payload.password) {
    return Response.json(
      { error: "Email et mot de passe requis" },
      { status: 400 },
    )
  }

  const [firstName, ...rest] = (payload.name ?? "").trim().split(/\s+/)
  const res = await fetch(nestApiUrl("/api/v1/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Transport": "cookie",
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      firstName: firstName || undefined,
      lastName: rest.join(" ") || undefined,
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return Response.json(
      data ?? { error: "Inscription impossible" },
      { status: res.status },
    )
  }

  // Relayer les Set-Cookie Nest vers le client.
  const response = Response.json(data, { status: res.status })
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : []
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie)
  }
  return response
}
