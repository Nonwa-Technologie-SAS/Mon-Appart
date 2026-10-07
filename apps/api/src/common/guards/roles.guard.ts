import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Role } from "@mon-appart/types"
import type { Request } from "express"

interface RequestWithUser extends Request {
  user?: {
    id: string
    roles?: string[]
  }
}

import { ROLES_KEY } from "../decorators/roles.decorator"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const roles = request.user?.roles ?? []
    return required.some((role) => roles.includes(role))
  }
}
