import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { Role } from "@/prisma/generated/client/enums"

export const PUBLISHER_ROLES: Role[] = [
  Role.OWNER,
  Role.AGENCY,
  Role.ADMIN,
  Role.SUPERADMIN,
]

export function isPublisherRole(role: unknown): role is Role {
  return (
    typeof role === "string" && PUBLISHER_ROLES.includes(role as Role)
  )
}

export function safeInternalPath(value: unknown) {
  if (typeof value !== "string") return null
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null
  }
  return value
}

export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  })
})

export async function requirePublisherPage(nextPath = "/espace") {
  const session = await getSession()
  if (!session) {
    redirect(`/connexion?next=${encodeURIComponent(nextPath)}`)
  }
  if (!isPublisherRole(session.user.role)) {
    redirect("/")
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
  const role = session.user.role as Role | undefined

  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden")
  }

  return session
}
