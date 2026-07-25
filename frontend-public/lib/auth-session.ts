import { cache } from "react"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { Role } from "@/prisma/generated/client/enums"

export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  })
})

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
