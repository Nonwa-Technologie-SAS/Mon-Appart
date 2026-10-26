import type { Role } from "@mon-appart/types"

/** Rôles assignables via POST /auth/register (jamais ADMIN / MODERATOR…). */
export const PUBLIC_REGISTER_ROLES = ["CUSTOMER", "OWNER", "AGENCY"] as const

export type PublicRegisterRole = (typeof PUBLIC_REGISTER_ROLES)[number]

export function resolveRegisterRole(
  accountType: string | undefined,
): PublicRegisterRole {
  if (!accountType || accountType === "CUSTOMER") return "CUSTOMER"
  if (accountType === "OWNER" || accountType === "AGENCY") return accountType
  return "CUSTOMER"
}

export function isPublicRegisterRole(
  value: string,
): value is PublicRegisterRole {
  return (PUBLIC_REGISTER_ROLES as readonly string[]).includes(value)
}

export function roleNeedsOrganization(
  role: Role | PublicRegisterRole,
): boolean {
  return role === "AGENCY"
}
