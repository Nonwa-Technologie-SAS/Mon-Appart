const DEFAULT_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:3000",
  "http://10.0.2.2:3000",
  "http://10.0.2.2:8081",
  "mobileapp://",
]

function allowedOrigins() {
  const fromEnv = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  return fromEnv?.length ? fromEnv : DEFAULT_ORIGINS
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin")
  const allowed = allowedOrigins()
  const allowAll = allowed.includes("*")
  const allowOrigin = allowAll
    ? origin || "*"
    : origin && allowed.includes(origin)
      ? origin
      : allowed[0]

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cookie, Expo-Origin, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

export function withCors(request: Request, response: Response) {
  const headers = corsHeaders(request)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export function corsPreflight(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}
