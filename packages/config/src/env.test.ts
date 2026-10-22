import { describe, expect, it } from "vitest"

import {
  isSwaggerEnabled,
  parseApiEnv,
  parseCorsOrigins,
  parseDuration,
} from "./index"

const secrets = {
  JWT_SECRET: "dev-only-change-me-please-32chars-min",
  JWT_REFRESH_SECRET: "dev-only-refresh-change-me-32chars",
}

describe("parseApiEnv", () => {
  it("accepte une configuration locale minimale", () => {
    const env = parseApiEnv({ ...secrets, APP_PORT: "4000" })
    expect(env.APP_PORT).toBe(4000)
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.APP_ENV).toBe("local")
  })

  it("refuse un secret trop court sans le recopier", () => {
    expect(() => parseApiEnv({ ...secrets, JWT_SECRET: "court" })).toThrow(
      /JWT_SECRET/,
    )
    try {
      parseApiEnv({ ...secrets, JWT_SECRET: "court" })
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toContain("court")
    }
  })

  it("exige METRICS_SCRAPE_TOKEN lorsque les métriques sont activées", () => {
    expect(() => parseApiEnv({ ...secrets, METRICS_ENABLED: "true" })).toThrow(
      /METRICS_SCRAPE_TOKEN/,
    )
    const env = parseApiEnv({
      ...secrets,
      METRICS_ENABLED: "true",
      METRICS_SCRAPE_TOKEN: "a".repeat(32),
    })
    expect(env.METRICS_SCRAPE_TOKEN).toHaveLength(32)
  })
})

describe("isSwaggerEnabled", () => {
  it("reste désactivé en production sans drapeau explicite", () => {
    expect(
      isSwaggerEnabled({ APP_ENV: "production", SWAGGER_ENABLED: undefined }),
    ).toBe(false)
  })

  it("est activé en local", () => {
    expect(
      isSwaggerEnabled({ APP_ENV: "local", SWAGGER_ENABLED: undefined }),
    ).toBe(true)
  })
})

describe("parseCorsOrigins", () => {
  it("découpe et ignore les vides", () => {
    expect(
      parseCorsOrigins(" http://localhost:3000, ,http://localhost:3001 "),
    ).toEqual(["http://localhost:3000", "http://localhost:3001"])
  })

  it("fusionne les URL applicatives, dédoublonne et refuse le joker", () => {
    expect(
      parseCorsOrigins(
        "http://localhost:3000,*",
        "http://localhost:3000/",
        "https://admin.example.com",
      ),
    ).toEqual(["http://localhost:3000", "https://admin.example.com"])
  })
})

describe("configuration Identity", () => {
  it("applique les valeurs par défaut", () => {
    const env = parseApiEnv(secrets)
    expect(env.OTP_LENGTH).toBe(6)
    expect(env.OTP_MAX_ATTEMPTS).toBe(5)
    expect(env.OTP_RESEND_COOLDOWN).toBe(60)
    expect(env.ARGON2_MEMORY_COST).toBe(19_456)
  })

  it("refuse une durée mal formée", () => {
    expect(() => parseApiEnv({ ...secrets, OTP_TTL: "cinq minutes" })).toThrow(
      /OTP_TTL/,
    )
  })

  it("refuse l'affichage des codes hors local", () => {
    expect(() =>
      parseApiEnv({
        ...secrets,
        APP_ENV: "production",
        AUTH_DEV_PRINT_CODES: "true",
      }),
    ).toThrow(/AUTH_DEV_PRINT_CODES/)
  })
})

describe("configuration Billing", () => {
  const mockSecret = "test-only-mock-webhook-secret-0123456789"

  it("désactive tout paiement par défaut", () => {
    const env = parseApiEnv(secrets)
    expect(env.PAYMENT_PROVIDER).toBe("none")
    expect(env.PAYMENT_ENVIRONMENT).toBe("test")
  })

  it("accepte le simulateur en local avec un secret suffisant", () => {
    const env = parseApiEnv({
      ...secrets,
      PAYMENT_PROVIDER: "mock",
      PAYMENT_MOCK_WEBHOOK_SECRET: mockSecret,
    })
    expect(env.PAYMENT_PROVIDER).toBe("mock")
  })

  it("exige le secret du simulateur sans le recopier", () => {
    expect(() =>
      parseApiEnv({
        ...secrets,
        PAYMENT_PROVIDER: "mock",
        PAYMENT_MOCK_WEBHOOK_SECRET: "trop-court",
      }),
    ).toThrow(/PAYMENT_MOCK_WEBHOOK_SECRET/)
    try {
      parseApiEnv({
        ...secrets,
        PAYMENT_PROVIDER: "mock",
        PAYMENT_MOCK_WEBHOOK_SECRET: "trop-court",
      })
    } catch (error) {
      expect((error as Error).message).not.toContain("trop-court")
    }
  })

  it.each([
    { APP_ENV: "production" },
    { APP_ENV: "staging" },
    { NODE_ENV: "production" },
    { PAYMENT_ENVIRONMENT: "live" },
  ])("refuse le simulateur avec %o", (override) => {
    expect(() =>
      parseApiEnv({
        ...secrets,
        PAYMENT_PROVIDER: "mock",
        PAYMENT_MOCK_WEBHOOK_SECRET: mockSecret,
        ...override,
      }),
    ).toThrow(/PAYMENT_PROVIDER/)
  })
})

describe("parseDuration", () => {
  it("convertit les unités usuelles", () => {
    expect(parseDuration("15m")).toBe(900_000)
    expect(parseDuration("30d")).toBe(2_592_000_000)
    expect(parseDuration("60s")).toBe(60_000)
  })

  it("rejette une valeur sans unité", () => {
    expect(() => parseDuration("15")).toThrow()
  })
})
