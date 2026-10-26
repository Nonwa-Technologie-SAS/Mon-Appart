import { describe, expect, it } from "vitest"

import {
  categoryOf,
  defaultEnabled,
  isEnabled,
  isLocked,
  preferenceKey,
} from "./notification-policy"

describe("notification-policy", () => {
  it("n'active pas le marketing par défaut", () => {
    expect(defaultEnabled("MARKETING", "IN_APP")).toBe(false)
    expect(defaultEnabled("MARKETING", "EMAIL")).toBe(false)
    expect(isLocked("MARKETING", "IN_APP")).toBe(false)
  })

  it("garde les notifications transactionnelles in-app hors marketing", () => {
    expect(isLocked("SAVED_SEARCHES", "IN_APP")).toBe(true)
    expect(isLocked("VISITS", "IN_APP")).toBe(true)
    expect(isLocked("MESSAGES", "IN_APP")).toBe(true)
    const stored = new Map([[preferenceKey("SAVED_SEARCHES", "IN_APP"), false]])
    expect(isEnabled("SAVED_SEARCHES", "IN_APP", stored)).toBe(true)
  })

  it("distingue désinscription marketing et alertes immobilières", () => {
    const stored = new Map([
      [preferenceKey("MARKETING", "EMAIL"), false],
      [preferenceKey("SAVED_SEARCHES", "PUSH"), true],
    ])
    expect(isEnabled("MARKETING", "EMAIL", stored)).toBe(false)
    expect(isEnabled("SAVED_SEARCHES", "PUSH", stored)).toBe(true)
    expect(categoryOf("NEW_PROPERTY")).toBe("SAVED_SEARCHES")
    expect(categoryOf("PRICE_DROP")).toBe("PRICE_DROPS")
  })
})
