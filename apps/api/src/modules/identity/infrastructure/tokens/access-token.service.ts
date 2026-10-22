import { Injectable } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ROLES, type Role } from "@mon-appart/types"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { AccessTokenClaims } from "../../domain/authenticated-user"
import { IdentityConfig } from "../../identity.config"

export const JWT_ISSUER = "mon-appart-api"
export const JWT_AUDIENCE = "mon-appart"

const KNOWN_ROLES = new Set<string>(ROLES)

export interface SignedAccessToken {
  token: string
  expiresAt: Date
}

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: IdentityConfig,
  ) {}

  async sign(input: {
    userId: string
    sessionId: string
    roles: Role[]
  }): Promise<SignedAccessToken> {
    const token = await this.jwt.signAsync(
      { sessionId: input.sessionId, roles: input.roles, typ: "access" },
      {
        secret: this.config.accessTokenSecret,
        algorithm: "HS256",
        subject: input.userId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: this.config.accessTokenTtlSeconds,
      },
    )
    return {
      token,
      expiresAt: new Date(
        Date.now() + this.config.accessTokenTtlSeconds * 1000,
      ),
    }
  }

  /** Vérification locale (signature, algorithme, émetteur, audience, expiration). */
  async verify(token: string): Promise<AccessTokenClaims> {
    let payload: Record<string, unknown>
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.config.accessTokenSecret,
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    } catch (error) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        throw authError(AuthErrorCode.TOKEN_EXPIRED)
      }
      throw authError(AuthErrorCode.TOKEN_INVALID)
    }

    const { sub, sessionId, roles, typ, iat, exp } = payload
    if (
      typ !== "access" ||
      typeof sub !== "string" ||
      typeof sessionId !== "string" ||
      typeof iat !== "number" ||
      typeof exp !== "number" ||
      !Array.isArray(roles) ||
      !roles.every(
        (role): role is Role =>
          typeof role === "string" && KNOWN_ROLES.has(role),
      )
    ) {
      throw authError(AuthErrorCode.TOKEN_INVALID)
    }
    return { sub, sessionId, roles, typ, iat, exp }
  }
}
