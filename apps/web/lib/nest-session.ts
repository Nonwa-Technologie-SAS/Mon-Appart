import { cache } from "react"
import { cookies, headers } from "next/headers"

import type { NestQuery } from "@/lib/nest-api"
import { nestServerOrigin } from "@/lib/nest-url"

const ACCESS_COOKIE = "ma_access"
const API_PREFIX = "/api/v1"

export type NestUser = {
  id: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  status: string
  roles: string[]
  emailVerified?: boolean
  phoneVerified?: boolean
}

export type WebSessionUser = {
  id: string
  email: string
  name: string
  role: string
  roles: string[]
}

export type WebSession = {
  user: WebSessionUser
}

const PUBLISHER_ROLE_RANK = [
  "SUPERADMIN",
  "ADMIN",
  "AGENCY",
  "OWNER",
  "AGENT",
] as const

export function primaryRole(roles: readonly string[]): string {
  for (const role of PUBLISHER_ROLE_RANK) {
    if (roles.includes(role)) return role
  }
  return roles[0] ?? "CUSTOMER"
}

export function nestUserToSession(user: NestUser): WebSession {
  const role = primaryRole(user.roles)
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    user.phone ||
    "Utilisateur"
  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name,
      role,
      roles: user.roles,
    },
  }
}

function nestOrigin(): string {
  return nestServerOrigin()
}

async function applyNestSetCookies(response: Response): Promise<void> {
  const jar = cookies()
  const list =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : []
  const cookieStore = await jar
  for (const raw of list) {
    const [pair] = raw.split(";")
    const eq = pair.indexOf("=")
    if (eq < 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (name === "ma_refresh") {
      cookieStore.set(name, value, {
        httpOnly: true,
        path: "/api/v1/auth",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      })
    } else if (name === "ma_csrf") {
      cookieStore.set(name, value, {
        httpOnly: false,
        path: "/",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      })
    }
  }
}

/** Persiste le JWT d'accès pour les RSC / Server Actions (TTL court). */
export async function persistNestAccessToken(accessToken: string): Promise<void> {
  const store = await cookies()
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 14, // ~14 min (JWT typiquement 15)
  })
}

export async function clearNestAccessToken(): Promise<void> {
  const store = await cookies()
  store.delete(ACCESS_COOKIE)
}

export async function nestServerRefresh(): Promise<string | null> {
  const headerStore = await headers()
  const cookieHeader = headerStore.get("cookie") ?? ""
  const csrfMatch = cookieHeader.match(/(?:^|;\s*)ma_csrf=([^;]+)/)
  const csrf = csrfMatch?.[1] ? decodeURIComponent(csrfMatch[1]) : null
  if (!csrf || !cookieHeader.includes("ma_refresh=")) return null

  const response = await fetch(`${nestOrigin()}${API_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      Cookie: cookieHeader,
    },
    body: "{}",
    cache: "no-store",
  })
  if (!response.ok) return null
  try {
    await applyNestSetCookies(response)
  } catch {
    // RSC : cookies().set peut être refusé — le client re-synchronisera.
  }
  const body = (await response.json()) as { accessToken?: string }
  if (!body.accessToken) return null
  try {
    await persistNestAccessToken(body.accessToken)
  } catch {
    // ignore
  }
  return body.accessToken
}

async function readAccessToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(ACCESS_COOKIE)?.value ?? null
}

export async function nestServerMe(
  accessToken: string,
): Promise<NestUser | null> {
  const response = await fetch(`${nestOrigin()}${API_PREFIX}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })
  if (!response.ok) return null
  return (await response.json()) as NestUser
}

export const getNestSession = cache(async (): Promise<WebSession | null> => {
  let token = await readAccessToken()
  if (!token) {
    token = await nestServerRefresh()
  }
  if (!token) return null
  let user = await nestServerMe(token)
  if (!user) {
    token = await nestServerRefresh()
    if (!token) return null
    user = await nestServerMe(token)
  }
  if (!user) return null
  return nestUserToSession(user)
})

/** Appel Nest authentifié depuis un Server Action (Bearer + refresh). */
export async function nestServerFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: NestQuery } = {},
): Promise<T> {
  let token = await readAccessToken()
  if (!token) token = await nestServerRefresh()
  if (!token) throw new Error("Unauthorized")

  const params = new URLSearchParams()
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value))
      }
    }
  }
  const qs = params.toString()
  const url = `${nestOrigin()}${API_PREFIX}${path}${qs ? `?${qs}` : ""}`

  const send = (bearer: string) =>
    fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    })

  let response = await send(token)
  if (response.status === 401) {
    const next = await nestServerRefresh()
    if (!next) throw new Error("Unauthorized")
    response = await send(next)
  }
  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as {
      message?: string
    } | null
    throw new Error(err?.message ?? `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
