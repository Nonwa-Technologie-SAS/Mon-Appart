import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import {
  ActorService,
  authError,
  AuthErrorCode,
  can,
  PERMISSIONS_KEY,
  type Actor,
  type AuthenticatedRequest,
} from "../../identity"

interface AdminRequest extends AuthenticatedRequest {
  adminActor?: Actor
}

/**
 * Garde du back-office, en plus des gardes globaux : rôles et statut relus en
 * base à chaque requête (un rôle retiré ou un compte suspendu perd l'accès
 * sans attendre l'expiration du JWT), `admin:access` exigé, puis chaque
 * permission déclarée par `@Permissions` sur la route.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly actors: ActorService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>()
    if (!request.user) throw authError(AuthErrorCode.UNAUTHENTICATED)
    const actor = await this.actors.resolve(request.user)
    const required =
      this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    for (const permission of ["admin:access", ...required]) {
      if (!can(actor, permission)) {
        throw authError(AuthErrorCode.INSUFFICIENT_PERMISSION)
      }
    }
    request.adminActor = actor
    return true
  }
}

/** Acteur résolu par `AdminAccessGuard`. */
export const AdminActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const actor = context.switchToHttp().getRequest<AdminRequest>().adminActor
    if (!actor) throw authError(AuthErrorCode.UNAUTHENTICATED)
    return actor
  },
)
