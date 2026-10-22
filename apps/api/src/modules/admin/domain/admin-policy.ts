import { ROLES, type Role } from "@mon-appart/types"

import { can, hasRole, type AccountDecision, type Actor } from "../../identity"
import { adminError } from "./admin-errors"

/** Rôles du back-office. */
export const STAFF_ROLES: readonly Role[] = [
  "MODERATOR",
  "TRUST_OFFICER",
  "SUPPORT",
  "ANALYST",
  "ADMIN",
  "SUPER_ADMIN",
]

/** Rôles qui ne s'attribuent, ne se retirent et ne s'administrent que par un SUPER_ADMIN. */
export const PRIVILEGED_ROLES: readonly Role[] = ["ADMIN", "SUPER_ADMIN"]

export const DECISION_PERMISSION: Record<AccountDecision, string> = {
  SUSPEND: "user:suspend",
  BAN: "user:ban",
  REACTIVATE: "user:reactivate",
}

/** Rôles qu'un acteur peut attribuer ou retirer à autrui. */
export function manageableRoles(actor: Actor): Role[] {
  if (!can(actor, "role:manage")) return []
  if (hasRole(actor, "SUPER_ADMIN")) return [...ROLES]
  return ROLES.filter((role) => !PRIVILEGED_ROLES.includes(role))
}

/**
 * Un compte du back-office ne s'administre qu'avec `role:manage`, un compte
 * ADMIN ou SUPER_ADMIN qu'en étant SUPER_ADMIN : le support ne déconnecte ni
 * ne suspend un administrateur.
 */
export function canAdministerTarget(
  actor: Actor,
  targetRoles: readonly Role[],
): boolean {
  if (targetRoles.some((role) => PRIVILEGED_ROLES.includes(role))) {
    return hasRole(actor, "SUPER_ADMIN")
  }
  if (targetRoles.some((role) => STAFF_ROLES.includes(role))) {
    return can(actor, "role:manage")
  }
  return true
}

function assertNotSelf(actor: Actor, targetPublicId: string): void {
  if (actor.publicId === targetPublicId) {
    throw adminError("ADMIN_TARGET_PROTECTED", "votre propre compte")
  }
}

export function assertCanChangeRole(
  actor: Actor,
  target: { publicId: string; roles: readonly Role[] },
  role: Role,
): void {
  assertNotSelf(actor, target.publicId)
  if (!manageableRoles(actor).includes(role)) {
    throw adminError("ADMIN_ROLE_FORBIDDEN")
  }
  if (!canAdministerTarget(actor, target.roles)) {
    throw adminError("ADMIN_TARGET_PROTECTED")
  }
}

export function canDecide(
  actor: Actor,
  target: { publicId: string; roles: readonly Role[] },
  decision: AccountDecision,
): boolean {
  return (
    actor.publicId !== target.publicId &&
    can(actor, DECISION_PERMISSION[decision]) &&
    canAdministerTarget(actor, target.roles)
  )
}

export function assertCanDecide(
  actor: Actor,
  target: { publicId: string; roles: readonly Role[] },
  decision: AccountDecision,
): void {
  assertNotSelf(actor, target.publicId)
  if (!can(actor, DECISION_PERMISSION[decision])) {
    throw adminError("ADMIN_ROLE_FORBIDDEN", DECISION_PERMISSION[decision])
  }
  if (!canAdministerTarget(actor, target.roles)) {
    throw adminError("ADMIN_TARGET_PROTECTED")
  }
}

export function canRevokeSessions(
  actor: Actor,
  target: { publicId: string; roles: readonly Role[] },
): boolean {
  return (
    actor.publicId !== target.publicId &&
    can(actor, "user:revoke_sessions") &&
    canAdministerTarget(actor, target.roles)
  )
}

/** `jean.dupont@example.com` → `j***@example.com` */
export function maskEmail(email: string | null): string | null {
  if (!email) return null
  const at = email.lastIndexOf("@")
  if (at <= 0) return "***"
  return `${email[0]}***${email.slice(at)}`
}

/** `+2250700000012` → `+225******12` */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  if (phone.length <= 6) return "***"
  return `${phone.slice(0, 4)}${"*".repeat(phone.length - 6)}${phone.slice(-2)}`
}

const SENSITIVE_KEY = /password|token|secret|otp|hash|signature|presigned/i

/**
 * Le journal d'audit ne contient pas de secret par construction ; ce filtre
 * protège aussi l'affichage contre une écriture fautive future.
 */
export function redactAuditValues(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]"
  if (Array.isArray(value)) {
    return value.map((entry) => redactAuditValues(entry, depth + 1))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY.test(key)
          ? "[masqué]"
          : redactAuditValues(entry, depth + 1),
      ]),
    )
  }
  return value
}
