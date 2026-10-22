import type { IssuedSession } from "../../application/services/session.service"
import type { SessionRecord } from "../../infrastructure/repositories/session.repository"
import type { UserRecord } from "../../infrastructure/repositories/user.repository"
import type {
  AuthResponseDto,
  SessionResponseDto,
  UserResponseDto,
} from "../dto/auth-response.dto"

/** Représentation publique : jamais d'identifiant interne ni de hash. */
export function serializeUser(user: UserRecord): UserResponseDto {
  return {
    id: user.publicId,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    roles: user.roles,
    createdAt: user.createdAt.toISOString(),
  }
}

export function serializeAuth(
  issued: IssuedSession,
  includeRefreshToken: boolean,
): AuthResponseDto {
  return {
    tokenType: "Bearer",
    accessToken: issued.accessToken,
    accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
    ...(includeRefreshToken ? { refreshToken: issued.refreshToken } : {}),
    refreshTokenExpiresAt: issued.refreshTokenExpiresAt.toISOString(),
    sessionId: issued.sessionId,
    user: serializeUser(issued.user),
  }
}

export function serializeSession(
  session: SessionRecord,
  currentSessionId: string,
): SessionResponseDto {
  return {
    id: session.familyId,
    deviceName: session.deviceName,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    lastActiveAt: (session.lastUsedAt ?? session.createdAt).toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    current: session.familyId === currentSessionId,
  }
}
