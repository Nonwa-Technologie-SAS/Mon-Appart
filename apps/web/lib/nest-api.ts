/**
 * Client HTTP Nest pour le site public (pattern admin).
 * Access token en mémoire ; refresh HttpOnly + CSRF `ma_csrf`.
 */

import { nestApiUrl } from "@/lib/nest-url"

const API_PREFIX = "/api/v1"
const CSRF_COOKIE = "ma_csrf"

export class NestApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
    readonly details: unknown = null,
  ) {
    super(message)
    this.name = "NestApiError"
  }
}

export interface NestAuthResult {
  accessToken: string
  user: { id: string }
}

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
let onSessionLost: (() => void) | null = null

export function setNestAccessToken(token: string | null): void {
  accessToken = token
}

export function getNestAccessToken(): string | null {
  return accessToken
}

export function onNestSessionExpired(handler: (() => void) | null): void {
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

async function parseError(response: Response): Promise<NestApiError> {
  try {
    const body = (await response.json()) as {
      code?: string
      message?: string
      requestId?: string | null
      details?: unknown
    }
    return new NestApiError(
      response.status,
      body.code ?? "HTTP_ERROR",
      body.message ?? `Erreur ${response.status}`,
      body.requestId ?? null,
      body.details ?? null,
    )
  } catch {
    return new NestApiError(
      response.status,
      "HTTP_ERROR",
      response.status >= 500
        ? "Le service est momentanément indisponible."
        : `Erreur ${response.status}`,
    )
  }
}

export function refreshNestSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const csrf = readCookie(CSRF_COOKIE)
    if (!csrf) return false
    const response = await fetch(nestApiUrl(`${API_PREFIX}/auth/refresh`), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: "{}",
    })
    if (!response.ok) {
      accessToken = null
      return false
    }
    const body = (await response.json()) as NestAuthResult
    accessToken = body.accessToken
    return true
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

export async function nestLogin(
  identifier: string,
  password: string,
): Promise<void> {
  const response = await fetch(nestApiUrl(`${API_PREFIX}/auth/login`), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Transport": "cookie",
    },
    body: JSON.stringify({ identifier, password }),
  })
  if (!response.ok) throw await parseError(response)
  const body = (await response.json()) as NestAuthResult
  accessToken = body.accessToken
}

export async function nestRegister(input: {
  email?: string
  phone?: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<void> {
  const response = await fetch(nestApiUrl(`${API_PREFIX}/auth/register`), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Transport": "cookie",
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw await parseError(response)
  const body = (await response.json()) as NestAuthResult
  accessToken = body.accessToken
}

export async function nestLogout(): Promise<void> {
  if (accessToken) {
    await fetch(nestApiUrl(`${API_PREFIX}/auth/logout`), {
      method: "POST",
      credentials: "same-origin",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined)
  }
  accessToken = null
}

export type NestQuery = Record<
  string,
  string | number | boolean | null | undefined
>

export function withNestQuery(path: string, query: NestQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

/** Requête authentifiée (client). 401 → refresh → un retry. */
export async function nestApi<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: NestQuery } = {},
): Promise<T> {
  const send = () =>
    fetch(nestApiUrl(`${API_PREFIX}${withNestQuery(path, init.query)}`), {
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
    if (!(await refreshNestSession())) {
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

/** GET public (SSR/RSC) sans Bearer — credentials cookies si same-origin. */
export async function nestPublicFetch<T>(
  path: string,
  init?: { query?: NestQuery; headers?: HeadersInit; cache?: RequestCache },
): Promise<T> {
  const url = nestApiUrl(`${API_PREFIX}${withNestQuery(path, init?.query)}`)
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: init?.cache ?? "no-store",
  })
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}
