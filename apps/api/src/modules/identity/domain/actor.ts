import type { Role } from "@mon-appart/types"

/**
 * Utilisateur courant tel que le voient les modules métier : identifiant
 * interne, rôles relus en base et permissions effectives. Toujours dérivé du
 * JWT vérifié, jamais d'un identifiant fourni par le client.
 */
export interface Actor {
  userId: bigint
  publicId: string
  roles: readonly Role[]
  permissions: ReadonlySet<string>
}

export function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role)
}

/** SUPER_ADMIN satisfait toute permission, comme dans PermissionsGuard. */
export function can(actor: Actor, permission: string): boolean {
  return (
    actor.roles.includes("SUPER_ADMIN") || actor.permissions.has(permission)
  )
}
