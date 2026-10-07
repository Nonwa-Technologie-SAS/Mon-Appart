import { describe, expect, it } from "vitest"

import { decodeCursor, encodeCursor, sanitizePlainText } from "./index"

describe("cursor", () => {
  it("encode puis décode un curseur", () => {
    const payload = { id: "prop_1", createdAt: "2026-10-07T00:00:00.000Z" }
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload)
  })

  it("refuse un curseur illisible", () => {
    expect(decodeCursor("%%%")).toBeNull()
  })
})

describe("sanitizePlainText", () => {
  it("retire les caractères de contrôle et les espaces de bord", () => {
    expect(sanitizePlainText("  Cocody\u0000 \u0007")).toBe("Cocody")
  })
})
