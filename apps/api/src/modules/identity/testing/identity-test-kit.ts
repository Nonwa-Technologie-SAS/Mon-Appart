import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import { parseApiEnv } from "@mon-appart/config"
import { vi } from "vitest"

import type { IdentityActivity } from "../application/services/identity-activity.service"
import { IdentityConfig } from "../identity.config"
import { SecretHasher } from "../infrastructure/crypto/secret-hasher"
import { AccessTokenService } from "../infrastructure/tokens/access-token.service"

export const TEST_SECRETS = {
  JWT_SECRET: "unit-test-access-secret-0123456789abcdef",
  JWT_REFRESH_SECRET: "unit-test-refresh-secret-0123456789abcdef",
}

export function makeConfig(
  overrides: Record<string, string> = {},
): IdentityConfig {
  const env = parseApiEnv({ APP_ENV: "test", ...TEST_SECRETS, ...overrides })
  return new IdentityConfig(new ConfigService(env))
}

export function makeTokens(config = makeConfig()): AccessTokenService {
  return new AccessTokenService(new JwtService({}), config)
}

export function makeHasher(config = makeConfig()): SecretHasher {
  return new SecretHasher(config.hashKey)
}

/** Redis absent : les composants basculent sur leur repli mémoire. */
export const noRedis = { getClient: () => null } as never

const counter = () => ({ inc: vi.fn() })

export function makeActivity() {
  return {
    audit: vi.fn(async () => undefined),
    emit: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    metrics: {
      auth: {
        loginSuccess: counter(),
        loginFailure: counter(),
        refresh: counter(),
        refreshReuse: counter(),
        otpSent: counter(),
        otpFailure: counter(),
        passwordResetRequested: counter(),
      },
    },
  } as unknown as IdentityActivity & {
    audit: ReturnType<typeof vi.fn>
    emit: ReturnType<typeof vi.fn>
  }
}
