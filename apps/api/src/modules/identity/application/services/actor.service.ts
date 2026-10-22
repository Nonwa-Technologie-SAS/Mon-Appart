import { Injectable } from "@nestjs/common"

import { AppException } from "../../../../common/http/app-exception"
import { UserStatus } from "../../../../generated/prisma/enums"
import type { Actor } from "../../domain/actor"
import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import { RbacRepository } from "../../infrastructure/repositories/rbac.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"

const BLOCKED: Partial<Record<UserStatus, AuthErrorCode>> = {
  [UserStatus.SUSPENDED]: AuthErrorCode.ACCOUNT_SUSPENDED,
  [UserStatus.BANNED]: AuthErrorCode.ACCOUNT_BANNED,
  [UserStatus.INACTIVE]: AuthErrorCode.ACCOUNT_INACTIVE,
}

/**
 * Résout l'acteur d'une requête authentifiée. Les rôles sont relus en base :
 * un rôle retiré prend effet sans attendre l'expiration de l'access token.
 */
@Injectable()
export class ActorService {
  constructor(
    private readonly users: UserRepository,
    private readonly rbac: RbacRepository,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<Actor> {
    const record = await this.users.findByPublicId(user.id)
    if (!record) throw authError(AuthErrorCode.UNAUTHENTICATED)
    const blocked = BLOCKED[record.status]
    if (blocked) throw authError(blocked)
    return {
      userId: record.id,
      publicId: record.publicId,
      roles: record.roles,
      permissions: await this.rbac.permissionsFor(record.roles),
    }
  }

  /** Routes publiques : un compte bloqué consulte comme un visiteur anonyme. */
  async resolveOptional(
    user: AuthenticatedUser | undefined,
  ): Promise<Actor | null> {
    if (!user) return null
    try {
      return await this.resolve(user)
    } catch (error) {
      if (error instanceof AppException) return null
      throw error
    }
  }
}
