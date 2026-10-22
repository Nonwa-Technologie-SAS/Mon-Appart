"use server"

import {
  nestRegisterCustomer,
  nestSignIn,
  nestSignOut,
} from "@/app/actions/nest-auth"
import {
  agencySchema,
  credentialsSchema,
  firstZodError,
  staffSchema,
} from "@/lib/auth-schemas"
import { requireRole } from "@/lib/auth-session"
import { Role } from "@/lib/domain-enums"

export type AuthActionState = {
  error?: string
  success?: boolean
}

/** Inscription propriétaire → Nest CUSTOMER (élévation OWNER via admin Nest). */
export async function registerOwner(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }
  return nestRegisterCustomer(_prev, formData)
}

/** Inscription agence → Nest CUSTOMER (élévation AGENCY via admin Nest). */
export async function registerAgency(
  _prev: AuthActionState,
  formData: FormData,
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
  return nestRegisterCustomer(_prev, formData)
}

export async function createStaffUser(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await requireRole(Role.SUPERADMIN, Role.ADMIN)
  } catch {
    return { error: "Accès réservé aux administrateurs" }
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

  return {
    error:
      "La création de comptes staff se fait via le back-office Nest (apps/admin), pas via le prototype web.",
  }
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return nestSignIn(_prev, formData)
}

export async function signOut() {
  await nestSignOut()
}
