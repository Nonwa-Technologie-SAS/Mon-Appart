import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import { AccessTokenService } from "../../infrastructure/tokens/access-token.service"
import { SessionRevocationStore } from "../../infrastructure/tokens/session-revocation.store"
import {
  IS_PUBLIC_KEY,
  OPTIONAL_AUTH_KEY,
  type AuthenticatedRequest,
} from "../decorators/auth.decorators"

/**
 * Garde global. Vérifie le JWT localement puis la liste de révocation Redis ;
 * pas de requête PostgreSQL par appel. Les opérations sensibles revérifient la
 * session en base dans leur service.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
    private readonly revocations: SessionRevocationStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true
    const targets = [context.getHandler(), context.getClass()]
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      targets,
    )
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (isPublic) {
      const optional = this.reflector.getAllAndOverride<boolean | undefined>(
        OPTIONAL_AUTH_KEY,
        targets,
      )
      if (optional) await this.attachOptionalUser(request)
      return true
    }

    const token = extractBearer(request.headers.authorization)
    if (!token) throw authError(AuthErrorCode.UNAUTHENTICATED)
    await this.attachUser(request, token)
    return true
  }

  private async attachUser(
    request: AuthenticatedRequest,
    token: string,
  ): Promise<void> {
    const claims = await this.tokens.verify(token)
    if (await this.revocations.isRevoked(claims.sessionId)) {
      throw authError(AuthErrorCode.SESSION_REVOKED)
    }
    request.user = {
      id: claims.sub,
      sessionId: claims.sessionId,
      roles: claims.roles,
    }
  }

  private async attachOptionalUser(
    request: AuthenticatedRequest,
  ): Promise<void> {
    const token = extractBearer(request.headers.authorization)
    if (!token) return
    try {
      await this.attachUser(request, token)
    } catch {
      request.user = undefined
    }
  }
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token, extra] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token || extra !== undefined)
    return null
  return token
}
