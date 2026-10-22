"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  clearNestAccessToken,
  nestUserToSession,
  persistNestAccessToken,
  primaryRole,
  type NestUser,
} from "@/lib/nest-session"
import { isPublisherRole, safeInternalPath } from "@/lib/auth-session"

const API_PREFIX = "/api/v1"

function nestOrigin(): string {
  return (
    process.env.NEST_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "")
}

async function applySetCookies(response: Response): Promise<void> {
  const list =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : []
  const store = await cookies()
  for (const raw of list) {
    const [pair] = raw.split(";")
    const eq = pair.indexOf("=")
    if (eq < 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (name === "ma_refresh") {
      store.set(name, value, {
        httpOnly: true,
        path: "/api/v1/auth",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      })
    } else if (name === "ma_csrf") {
      store.set(name, value, {
        httpOnly: false,
        path: "/",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      })
    }
  }
}

export type NestAuthActionState = {
  error?: string
}

export async function nestSignIn(
  _prev: NestAuthActionState,
  formData: FormData,
): Promise<NestAuthActionState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) {
    return { error: "Email et mot de passe requis" }
  }

  const response = await fetch(`${nestOrigin()}${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Transport": "cookie",
    },
    body: JSON.stringify({ identifier: email, password }),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string
    } | null
    return { error: body?.message ?? "Identifiants invalides" }
  }

  await applySetCookies(response)
  const body = (await response.json()) as {
    accessToken: string
    user: NestUser
  }
  await persistNestAccessToken(body.accessToken)

  const nextPath = safeInternalPath(formData.get("next"))
  if (nextPath) redirect(nextPath)

  const session = nestUserToSession(body.user)
  if (isPublisherRole(session.user.role)) {
    redirect("/espace")
  }
  redirect("/profil")
}

export async function nestSignOut(): Promise<void> {
  const store = await cookies()
  const access = store.get("ma_access")?.value
  if (access) {
    await fetch(`${nestOrigin()}${API_PREFIX}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    }).catch(() => undefined)
  }
  store.delete("ma_refresh")
  store.delete("ma_csrf")
  await clearNestAccessToken()
  redirect("/connexion")
}

export async function nestRegisterCustomer(
  _prev: NestAuthActionState,
  formData: FormData,
): Promise<NestAuthActionState> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) {
    return { error: "Email et mot de passe requis" }
  }
  const [firstName, ...rest] = name.split(/\s+/)
  const lastName = rest.join(" ") || undefined

  const response = await fetch(`${nestOrigin()}${API_PREFIX}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Transport": "cookie",
    },
    body: JSON.stringify({
      email,
      password,
      firstName: firstName || undefined,
      lastName,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string
    } | null
    return {
      error:
        body?.message ??
        "Impossible de créer le compte. Le rôle éditeur (OWNER) doit être attribué côté API/admin après inscription.",
    }
  }

  await applySetCookies(response)
  const body = (await response.json()) as {
    accessToken: string
    user: NestUser
  }
  await persistNestAccessToken(body.accessToken)

  // Compte CUSTOMER : pas d'espace éditeur tant que le rôle n'est pas élevé.
  void primaryRole(body.user.roles)
  redirect("/connexion?registered=1")
}

export async function syncNestAccessToken(accessToken: string): Promise<void> {
  await persistNestAccessToken(accessToken)
}
