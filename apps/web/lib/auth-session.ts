import { cache } from "react"
import { redirect } from "next/navigation"

import { Role } from "@/lib/domain-enums"
import {
  getNestSession,
  type WebSession,
} from "@/lib/nest-session"

export type { WebSession }

export const PUBLISHER_ROLES: string[] = [
  Role.OWNER,
  Role.AGENCY,
  Role.ADMIN,
  Role.SUPERADMIN,
  Role.AGENT,
]

export function isPublisherRole(role: unknown): boolean {
  return typeof role === "string" && PUBLISHER_ROLES.includes(role)
}

export function safeInternalPath(value: unknown) {
  if (typeof value !== "string") return null
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return null
  }
  return value
}

/** Session Nest uniquement (JWT + cookies ma_*). */
export const getSession = cache(async (): Promise<WebSession | null> => {
  return getNestSession()
})

export async function requireAuthPage(nextPath = "/profil") {
  const session = await getSession()
  if (!session) {
    redirect(`/connexion?next=${encodeURIComponent(nextPath)}`)
  }
  return session
}

export async function requirePublisherPage(nextPath = "/espace") {
  const session = await requireAuthPage(nextPath)
  if (!isPublisherRole(session.user.role)) {
    redirect("/profil")
  }
  return session
}

export async function requireSession() {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function requireRole(...allowedRoles: Role[]) {
  const session = await requireSession()
  const role = session.user.role

  if (!role || !allowedRoles.includes(role as Role)) {
    throw new Error("Forbidden")
  }

  return session
}
