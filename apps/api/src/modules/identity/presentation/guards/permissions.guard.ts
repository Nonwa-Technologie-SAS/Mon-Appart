import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import { RbacRepository } from "../../infrastructure/repositories/rbac.repository"
import {
  PERMISSIONS_KEY,
  type AuthenticatedRequest,
} from "../decorators/auth.decorators"
import { SUPER_ROLE } from "./roles.guard"

/** Permissions déduites des rôles du JWT via la matrice role_permissions (cache 60 s). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required || required.length === 0) return true

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user
    if (!user) throw authError(AuthErrorCode.UNAUTHENTICATED)
    if (user.roles.includes(SUPER_ROLE)) return true

    const granted = await this.rbac.permissionsFor(user.roles)
    if (!required.every((permission) => granted.has(permission))) {
      throw authError(AuthErrorCode.INSUFFICIENT_PERMISSION)
    }
    return true
  }
}
