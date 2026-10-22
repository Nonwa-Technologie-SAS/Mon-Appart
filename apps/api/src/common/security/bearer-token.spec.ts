import { describe, expect, it } from "vitest"

import { bearerMatches } from "./bearer-token"

describe("bearerMatches", () => {
  const token = "a".repeat(32)

  it("accepte un Bearer exact", () => {
    expect(bearerMatches(`Bearer ${token}`, token)).toBe(true)
    expect(bearerMatches(`bearer ${token}`, token)).toBe(true)
  })

  it("refuse token manquant, tronqué ou différent", () => {
    expect(bearerMatches(undefined, token)).toBe(false)
    expect(bearerMatches("Bearer ", token)).toBe(false)
    expect(bearerMatches(`Bearer ${token.slice(0, -1)}x`, token)).toBe(false)
    expect(bearerMatches(`Bearer ${token}`, "")).toBe(false)
  })
})
