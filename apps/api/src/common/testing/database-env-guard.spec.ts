import { describe, expect, it } from "vitest"

import {
  databaseName,
  isProductionLike,
  isTestDatabase,
} from "../../../prisma/seed/environment"

describe("garde-fous base de test", () => {
  it("accepte uniquement les bases dont le nom se termine par _test", () => {
    expect(
      isTestDatabase("postgresql://u:p@127.0.0.1:5432/mon_appart_test"),
    ).toBe(true)
    expect(isTestDatabase("postgresql://u:p@127.0.0.1:5432/mon_appart")).toBe(
      false,
    )
    expect(databaseName("postgresql://u:p@127.0.0.1:5433/mon_appart_test")).toBe(
      "mon_appart_test",
    )
  })

  it("détecte les environnements production-like", () => {
    expect(isProductionLike({ NODE_ENV: "test", APP_ENV: "test" })).toBe(false)
    expect(isProductionLike({ NODE_ENV: "production" })).toBe(true)
    expect(isProductionLike({ APP_ENV: "staging" })).toBe(true)
    expect(isProductionLike({ APP_ENV: "production" })).toBe(true)
  })
})
