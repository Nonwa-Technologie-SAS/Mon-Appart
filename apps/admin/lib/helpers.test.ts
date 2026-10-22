import { describe, expect, it } from "vitest"

import { nextDay } from "@/components/audit-log-view"
import { actionsFor } from "@/components/reports/report-detail"
import { availableActions } from "@/components/verifications/verification-detail"

import { formatAge, formatPrice } from "./format"
import type { AdminMe } from "./types"

describe("aides d'affichage", () => {
  it("rend la borne « jusqu'au » inclusive", () => {
    expect(nextDay("2026-10-13")).toBe("2026-10-14")
    expect(nextDay("2026-12-31")).toBe("2027-01-01")
    expect(nextDay("")).toBe("")
    expect(nextDay("13/10/2026")).toBe("")
  })

  it("propose les mesures de signalement selon la cible et les droits", () => {
    expect(actionsFor("LISTING", false)).toEqual([
      "NONE",
      "VERIFICATION_REVIEW_REQUESTED",
    ])
    expect(actionsFor("LISTING", true)).toContain("LISTING_SUSPENDED")
    expect(actionsFor("MESSAGE", true)).toEqual(["NONE", "CONVERSATION_CLOSED"])
    expect(actionsFor("USER", true)).not.toContain("LISTING_SUSPENDED")
  })

  it("sépare instruction et décision sur les vérifications", () => {
    const moderator: AdminMe = {
      id: "m",
      name: null,
      roles: ["MODERATOR"],
      permissions: ["verification:read", "verification:review"],
      manageableRoles: [],
    }
    expect(availableActions(moderator, "IN_REVIEW")).toEqual([
      "assign",
      "request-information",
      "escalate",
    ])
    expect(availableActions(moderator, "VERIFIED")).toEqual([])

    const officer: AdminMe = {
      ...moderator,
      permissions: ["verification:read", "verification:revoke"],
    }
    expect(availableActions(officer, "VERIFIED")).toEqual(["revoke"])
  })

  it("formate prix et ancienneté sans inventer de valeur", () => {
    expect(formatPrice(null)).toBe("Sans prix")
    expect(formatAge(null)).toBe("—")
    const now = Date.parse("2026-10-13T12:00:00Z")
    expect(formatAge("2026-10-13T11:30:00Z", now)).toBe("30 min")
    expect(formatAge("2026-10-10T12:00:00Z", now)).toBe("3 j")
  })
})
