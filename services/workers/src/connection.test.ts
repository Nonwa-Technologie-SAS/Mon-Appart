import { describe, expect, it } from "vitest"

import { redisConnectionFromUrl } from "./connection"

describe("redisConnectionFromUrl", () => {
  it("lit l'hôte et le port", () => {
    expect(redisConnectionFromUrl("redis://localhost:6379")).toMatchObject({
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    })
  })

  it("ne place pas le mot de passe dans une propriété inattendue", () => {
    const connection = redisConnectionFromUrl("redis://:secret@localhost:6379")
    expect(connection.password).toBe("secret")
    expect(JSON.stringify({ host: connection.host })).not.toContain("secret")
  })
})
