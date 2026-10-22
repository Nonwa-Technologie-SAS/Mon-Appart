import { Injectable } from "@nestjs/common"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import { SessionRevocationReason } from "../../domain/identity-events"
import type { SessionRecord } from "../../infrastructure/repositories/session.repository"
import {
  UserRepository,
  type UserRecord,
} from "../../infrastructure/repositories/user.repository"
import type { ClientContext } from "../client-context"
import { SessionService } from "./session.service"

@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
  ) {}

  async me(auth: AuthenticatedUser): Promise<UserRecord> {
    const user = await this.users.findByPublicId(auth.id)
    if (!user) throw authError(AuthErrorCode.SESSION_REVOKED)
    return user
  }

  async update(
    auth: AuthenticatedUser,
    input: { firstName?: string | null; lastName?: string | null },
  ): Promise<UserRecord> {
    const user = await this.me(auth)
    const data: { firstName?: string | null; lastName?: string | null } = {}
    if (input.firstName !== undefined)
      data.firstName = input.firstName?.trim() || null
    if (input.lastName !== undefined)
      data.lastName = input.lastName?.trim() || null
    if (Object.keys(data).length > 0)
      await this.users.updateProfile(user.id, data)
    return this.me(auth)
  }

  async listSessions(auth: AuthenticatedUser): Promise<SessionRecord[]> {
    const user = await this.me(auth)
    await this.sessions.assertActive(user, auth.sessionId)
    return this.sessions.listActive(user)
  }

  async revokeSession(
    auth: AuthenticatedUser,
    sessionId: string,
    context: ClientContext,
  ): Promise<void> {
    const user = await this.me(auth)
    await this.sessions.assertActive(user, auth.sessionId)
    const revoked = await this.sessions.revokeAndPublish(
      user,
      { familyId: sessionId },
      SessionRevocationReason.USER_REVOKED,
      context,
    )
    if (revoked.length === 0) throw authError(AuthErrorCode.SESSION_NOT_FOUND)
  }
}
