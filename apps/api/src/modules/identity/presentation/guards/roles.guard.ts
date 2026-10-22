import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Role } from "@mon-appart/types"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import {
  ROLES_KEY,
  type AuthenticatedRequest,
} from "../decorators/auth.decorators"

export const SUPER_ROLE: Role = "SUPER_ADMIN"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required || required.length === 0) return true

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user
    if (!user) throw authError(AuthErrorCode.UNAUTHENTICATED)
    if (user.roles.includes(SUPER_ROLE)) return true
    if (!required.some((role) => user.roles.includes(role))) {
      throw authError(AuthErrorCode.INSUFFICIENT_ROLE)
    }
    return true
  }
}
