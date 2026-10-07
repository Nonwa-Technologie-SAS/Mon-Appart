import { SetMetadata } from "@nestjs/common"
import type { Role } from "@mon-appart/types"

export const ROLES_KEY = "roles"

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export const IS_PUBLIC_KEY = "isPublic"

/** Réservé au futur garde d'authentification global. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
