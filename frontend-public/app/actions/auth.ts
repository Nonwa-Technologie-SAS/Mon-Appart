"use server"

import { randomUUID } from "node:crypto"

import { hashPassword } from "better-auth/crypto"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import {
  agencySchema,
  credentialsSchema,
  firstZodError,
  signInSchema,
  staffSchema,
} from "@/lib/auth-schemas"
import {
  isPublisherRole,
  requireRole,
  safeInternalPath,
} from "@/lib/auth-session"
import { createUserWithPassword } from "@/lib/create-user"
import { prisma } from "@/lib/prisma"
import { Role } from "@/prisma/generated/client/enums"

export type AuthActionState = {
  error?: string
  success?: boolean
}

export async function registerOwner(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    await createUserWithPassword(parsed.data, Role.OWNER)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer le compte"
    return { error: message }
  }

  redirect("/connexion?registered=1")
}

export async function registerAgency(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = agencySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    agencyName: formData.get("agencyName"),
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    const existingAgency = await prisma.agency.findUnique({
      where: { email: parsed.data.email },
    })
    if (existingAgency) {
      return { error: "Une agence existe déjà avec cet email" }
    }

    await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: parsed.data.agencyName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          address: parsed.data.address,
        },
      })

      const userId = randomUUID()
      const hashedPassword = await hashPassword(parsed.data.password)

      await tx.user.create({
        data: {
          id: userId,
          name: parsed.data.name,
          email: parsed.data.email,
          emailVerified: false,
          role: Role.AGENCY,
          agencyId: agency.id,
        },
      })

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashedPassword,
        },
      })
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer le compte"
    return { error: message }
  }

  redirect("/connexion?registered=1")
}

export async function createStaffUser(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    await requireRole(Role.SUPERADMIN)
  } catch {
    return { error: "Accès réservé aux super administrateurs" }
  }

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    await createUserWithPassword(parsed.data, parsed.data.role)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer l'utilisateur"
    return { error: message }
  }

  return { success: true }
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Identifiants invalides"
    return { error: message }
  }

  const nextPath = safeInternalPath(formData.get("next"))
  if (nextPath) {
    redirect(nextPath)
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (isPublisherRole(session?.user.role)) {
    redirect("/espace")
  }

  redirect("/")
}

export async function signOut() {
  await auth.api.signOut({
    headers: await headers(),
  })
  redirect("/connexion")
}
