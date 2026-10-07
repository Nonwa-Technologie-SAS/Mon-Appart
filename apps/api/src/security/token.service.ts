import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService, type JwtSignOptions } from "@nestjs/jwt"
import type { Role } from "@mon-appart/types"

export interface AccessTokenPayload {
  sub: string
  roles: Role[]
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccess(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      expiresIn: this.ttl("JWT_ACCESS_TTL", "15m"),
    })
  }

  signRefresh(payload: { sub: string }): Promise<string> {
    return this.jwt.signAsync(
      { ...payload, typ: "refresh" },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.ttl("JWT_REFRESH_TTL", "30d"),
      },
    )
  }

  private ttl(key: string, fallback: string): JwtSignOptions["expiresIn"] {
    const value = this.config.get<string>(key)
    return (value && value.length > 0 ? value : fallback) as JwtSignOptions["expiresIn"]
  }
}
