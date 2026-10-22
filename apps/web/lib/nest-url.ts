/**
 * Base URL Nest. Le site web exige Nest (rewrite `/api/v1/*`).
 * `NEXT_PUBLIC_NEST_API_URL=same-origin` (défaut) ou URL absolue.
 */

export function nestApiConfigured(): boolean {
  const publicUrl = process.env.NEXT_PUBLIC_NEST_API_URL?.trim()
  if (publicUrl === "off") return false
  // Toujours considéré configuré sauf opt-out explicite.
  return true
}

/**
 * Préfixe pour `/api/v1/...` côté navigateur.
 * - "" = same-origin (rewrite Next)
 * - URL absolue = appel direct
 */
export function nestApiBaseUrl(): string | null {
  if (!nestApiConfigured()) return null
  const raw = process.env.NEXT_PUBLIC_NEST_API_URL?.trim()
  if (!raw || raw === "/" || raw === "same-origin") return ""
  if (raw === "off") return null
  return raw.replace(/\/$/, "")
}

/** Origine Nest absolue pour les fetch serveur (Node exige une URL absolue). */
export function nestServerOrigin(): string {
  const fromEnv =
    process.env.NEST_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_NEST_API_URL?.trim() ||
    "http://localhost:4000"
  return fromEnv
    .replace(/\/+$/, "")
    .replace(/^same-origin$/i, "http://localhost:4000")
    .replace(/^\/$/, "http://localhost:4000")
}

export function nestApiUrl(path: string): string {
  const base = nestApiBaseUrl()
  if (base === null) {
    throw new Error(
      "NEST_API_UNCONFIGURED: définissez NEXT_PUBLIC_NEST_API_URL (same-origin recommandé).",
    )
  }
  const normalized = path.startsWith("/") ? path : `/${path}`

  // Navigateur : relative same-origin OK (rewrite Next).
  if (typeof window !== "undefined") {
    return `${base}${normalized}`
  }

  // Serveur (RSC / actions) : fetch Node exige une URL absolue.
  if (base) return `${base}${normalized}`
  return `${nestServerOrigin()}${normalized}`
}
