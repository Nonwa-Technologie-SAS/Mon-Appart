/**
 * Client HTTP du back-office. Le jeton d'accès vit en mémoire seulement ; le
 * refresh token reste en cookie HttpOnly posé par l'API (mode cookie), et sa
 * rotation exige l'en-tête CSRF égal au cookie `ma_csrf`.
 */

const API_PREFIX = "/api/v1"
const CSRF_COOKIE = "ma_csrf"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
    readonly details: unknown = null,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export interface AuthResult {
  accessToken: string
  user: { id: string }
}

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
let onSessionLost: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

/** Appelé quand le refresh échoue : la session est perdue. */
export function onSessionExpired(handler: (() => void) | null): void {
  onSessionLost = handler
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  for (const part of document.cookie.split("; ")) {
    const [key, ...value] = part.split("=")
    if (key === name) return decodeURIComponent(value.join("="))
  }
  return null
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      code?: string
      message?: string
      requestId?: string | null
      details?: unknown
    }
    return new ApiError(
      response.status,
      body.code ?? "HTTP_ERROR",
      body.message ?? `Erreur ${response.status}`,
      body.requestId ?? null,
      body.details ?? null,
    )
  } catch {
    return new ApiError(
      response.status,
      "HTTP_ERROR",
      response.status >= 500
        ? "Le service est momentanément indisponible."
        : `Erreur ${response.status}`,
    )
  }
}

/** Rotation du refresh token par cookie ; une seule rotation à la fois. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const csrf = readCookie(CSRF_COOKIE)
    if (!csrf) return false
    const response = await fetch(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: "{}",
    })
    if (!response.ok) {
      accessToken = null
      return false
    }
    const body = (await response.json()) as AuthResult
    accessToken = body.accessToken
    return true
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

export async function login(
  identifier: string,
  password: string,
): Promise<void> {
  const response = await fetch(`${API_PREFIX}/auth/login`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Transport": "cookie",
    },
    body: JSON.stringify({ identifier, password }),
  })
  if (!response.ok) throw await parseError(response)
  const body = (await response.json()) as AuthResult
  accessToken = body.accessToken
}

export async function logout(): Promise<void> {
  if (accessToken) {
    await fetch(`${API_PREFIX}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined)
  }
  accessToken = null
}

export type Query = Record<string, string | number | boolean | null | undefined>

export function withQuery(path: string, query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

/**
 * Requête authentifiée. Un 401 (jeton absent ou expiré) déclenche une
 * rotation puis un seul nouvel essai ; un second échec signale la perte de
 * session.
 */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const send = () =>
    fetch(`${API_PREFIX}${withQuery(path, init.query)}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })

  let response = await send()
  if (response.status === 401) {
    if (!(await refreshSession())) {
      const error = await parseError(response)
      onSessionLost?.()
      throw error
    }
    response = await send()
  }
  if (!response.ok) {
    const error = await parseError(response)
    if (response.status === 401) onSessionLost?.()
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
