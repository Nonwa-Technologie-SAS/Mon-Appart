import { describe, expect, it } from "vitest"

import { isSwaggerEnabled, parseApiEnv, parseCorsOrigins } from "./index"

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
    expect(parseCorsOrigins(" http://localhost:3000, ,http://localhost:3001 "))
      .toEqual(["http://localhost:3000", "http://localhost:3001"])
  })
})
