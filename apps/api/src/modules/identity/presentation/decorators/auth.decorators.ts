import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common"
import type { Role } from "@mon-appart/types"
import type { Request } from "express"

import type { ClientContext } from "../../application/client-context"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AuthenticatedUser } from "../../domain/authenticated-user"

export const IS_PUBLIC_KEY = "isPublic"
export const OPTIONAL_AUTH_KEY = "optionalAuth"
export const ROLES_KEY = "roles"
export const PERMISSIONS_KEY = "permissions"

/** Route accessible sans access token. Le garde JWT est global. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/**
 * Route publique qui reconnaît l'utilisateur s'il envoie un access token
 * valide. Un jeton absent, invalide ou révoqué donne un visiteur anonyme.
 */
export const OptionalAuth = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    SetMetadata(OPTIONAL_AUTH_KEY, true),
  )

/** Utilisateur authentifié s'il y en a un, sur une route `@OptionalAuth()`. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)

/** Au moins un des rôles. SUPER_ADMIN satisfait toujours la contrainte. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

/** Toutes les permissions `ressource:action` listées. */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user) throw authError(AuthErrorCode.UNAUTHENTICATED)
    return request.user
  },
)

export function clientContextFrom(request: Request): ClientContext {
  const userAgent = request.headers["user-agent"]
  return {
    ip: request.ip ?? null,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 512) : null,
    requestId: typeof request.id === "string" ? request.id : null,
  }
}

export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientContext =>
    clientContextFrom(context.switchToHttp().getRequest<Request>()),
)
