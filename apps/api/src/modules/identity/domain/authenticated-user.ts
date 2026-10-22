import type { Role } from "@mon-appart/types"

/**
 * Contexte d'authentification attaché à la requête, issu du JWT d'accès.
 * `id` est le `public_id` de l'utilisateur, jamais l'identifiant interne.
 */
export interface AuthenticatedUser {
  id: string
  sessionId: string
  roles: Role[]
}

export interface AccessTokenClaims {
  sub: string
  sessionId: string
  roles: Role[]
  typ: "access"
  iat: number
  exp: number
}
