import { describe, expect, it } from "vitest"

import { can, visibleNav } from "./permissions"
import type { AdminMe } from "./types"

function me(permissions: string[], roles = ["MODERATOR"]): AdminMe {
  return { id: "u", name: null, roles, permissions, manageableRoles: [] }
}

describe("permissions d'affichage", () => {
  it("n'accorde rien sans session", () => {
    expect(can(null, "admin:access")).toBe(false)
    expect(visibleNav(null)).toEqual([])
  })

  it("accorde tout au joker du SUPER_ADMIN", () => {
    const superAdmin = me(["*"], ["SUPER_ADMIN"])
    expect(can(superAdmin, "role:manage")).toBe(true)
    expect(visibleNav(superAdmin).map((item) => item.href)).toContain("/roles")
  })

  it("limite la navigation d'un modérateur à ses permissions", () => {
    const moderator = me(["admin:access", "listing:moderate", "report:review"])
    const hrefs = visibleNav(moderator).map((item) => item.href)
    expect(hrefs).toEqual(["/", "/listings", "/reports", "/settings/reasons"])
    expect(hrefs).not.toContain("/users")
    expect(hrefs).not.toContain("/audit")
  })

  it("ne montre pas la modération des annonces au support", () => {
    const support = me(["admin:access", "user:read"], ["SUPPORT"])
    const hrefs = visibleNav(support).map((item) => item.href)
    expect(hrefs).toEqual(["/", "/users"])
    expect(hrefs).not.toContain("/billing")
  })

  it("montre les événements de domaine aux opérateurs habilités", () => {
    const ops = me(["admin:access", "ops:events"], ["ADMIN"])
    expect(visibleNav(ops).map((item) => item.href)).toContain("/events")
  })

  it("montre la gouvernance IA aux analystes habilités", () => {
    const analyst = me(
      ["admin:access", "analytics:admin", "ai:admin"],
      ["ANALYST"],
    )
    expect(visibleNav(analyst).map((item) => item.href)).toContain("/ai")
  })

  it("montre la facturation aux seuls comptes habilités", () => {
    const finance = me(["admin:access", "billing:read"], ["FINANCE"])
    expect(visibleNav(finance).map((item) => item.href)).toEqual([
      "/",
      "/billing",
    ])
  })
})
