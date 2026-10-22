import type { Role } from "@mon-appart/types"

import type { ListingType } from "../../../generated/prisma/enums"
import { statusForDecision, type Actor } from "../../identity"
import { transitionActors } from "../../listing/domain/listing-status"
import {
  assertCanChangeRole,
  assertCanDecide,
  canRevokeSessions,
  manageableRoles,
  maskEmail,
  maskPhone,
  redactAuditValues,
} from "./admin-policy"
import {
  availableDecisions,
  CHECK_THRESHOLDS,
  consistencyChecks,
  historyReason,
  MODERATION_DECISIONS,
  MODERATION_RULES,
  moderationNotice,
  type ListingFacts,
} from "./moderation"

/** Extrait de la matrice du seed (vérifiée en base par `admin.db-spec`). */
const PERMISSIONS: Partial<Record<Role, string[]>> = {
  MODERATOR: [
    "admin:access",
    "user:read",
    "listing:moderate",
    "listing:suspend",
  ],
  SUPPORT: [
    "admin:access",
    "user:read",
    "user:pii",
    "user:revoke_sessions",
    "admin_note:create",
  ],
  ANALYST: ["admin:access", "analytics:admin"],
  ADMIN: [
    "admin:access",
    "user:read",
    "user:suspend",
    "user:ban",
    "user:reactivate",
    "user:revoke_sessions",
    "role:manage",
    "listing:moderate",
    "listing:suspend",
  ],
}

let sequence = 0

function actor(...roles: Role[]): Actor {
  sequence += 1
  return {
    userId: BigInt(sequence),
    publicId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    roles,
    permissions: new Set(roles.flatMap((role) => PERMISSIONS[role] ?? [])),
  }
}

function target(...roles: Role[]) {
  return { publicId: actor().publicId, roles }
}

function code(fn: () => unknown): string | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return (error as { code?: string }).code
  }
}

describe("rôles du back-office", () => {
  it("seuls ADMIN et SUPER_ADMIN gèrent les rôles", () => {
    for (const role of [
      "CUSTOMER",
      "MODERATOR",
      "TRUST_OFFICER",
      "SUPPORT",
      "ANALYST",
    ] as const) {
      expect(manageableRoles(actor(role))).toEqual([])
    }
    expect(manageableRoles(actor("ADMIN"))).not.toContain("ADMIN")
    expect(manageableRoles(actor("ADMIN"))).not.toContain("SUPER_ADMIN")
    expect(manageableRoles(actor("ADMIN"))).toContain("MODERATOR")
    expect(manageableRoles(actor("SUPER_ADMIN"))).toContain("SUPER_ADMIN")
  })

  it("interdit l'auto-élévation et la modification de son propre compte", () => {
    const admin = actor("ADMIN")
    expect(
      code(() =>
        assertCanChangeRole(
          admin,
          { publicId: admin.publicId, roles: admin.roles },
          "MODERATOR",
        ),
      ),
    ).toBe("ADMIN_TARGET_PROTECTED")
    expect(
      code(() => assertCanChangeRole(admin, target("CUSTOMER"), "SUPER_ADMIN")),
    ).toBe("ADMIN_ROLE_FORBIDDEN")
  })

  it("un ADMIN n'administre ni un autre ADMIN ni un SUPER_ADMIN", () => {
    const admin = actor("ADMIN")
    expect(
      code(() => assertCanChangeRole(admin, target("ADMIN"), "MODERATOR")),
    ).toBe("ADMIN_TARGET_PROTECTED")
    expect(
      code(() => assertCanDecide(admin, target("SUPER_ADMIN"), "SUSPEND")),
    ).toBe("ADMIN_TARGET_PROTECTED")
    expect(
      code(() => assertCanDecide(actor("SUPER_ADMIN"), target("ADMIN"), "BAN")),
    ).toBeUndefined()
  })

  it("le support ne change pas les rôles et ne touche pas aux comptes du staff", () => {
    const support = actor("SUPPORT")
    expect(
      code(() => assertCanChangeRole(support, target("CUSTOMER"), "MODERATOR")),
    ).toBe("ADMIN_ROLE_FORBIDDEN")
    expect(
      code(() => assertCanDecide(support, target("CUSTOMER"), "SUSPEND")),
    ).toBe("ADMIN_ROLE_FORBIDDEN")
    expect(canRevokeSessions(support, target("CUSTOMER"))).toBe(true)
    expect(canRevokeSessions(support, target("MODERATOR"))).toBe(false)
    expect(canRevokeSessions(support, target("ADMIN"))).toBe(false)
  })

  it("chaque décision de compte exige sa permission", () => {
    const moderator = actor("MODERATOR")
    expect(
      code(() => assertCanDecide(moderator, target("CUSTOMER"), "SUSPEND")),
    ).toBe("ADMIN_ROLE_FORBIDDEN")
    const admin = actor("ADMIN")
    for (const decision of ["SUSPEND", "BAN", "REACTIVATE"] as const) {
      expect(
        code(() => assertCanDecide(admin, target("CUSTOMER"), decision)),
      ).toBeUndefined()
    }
  })
})

describe("décisions sur les comptes", () => {
  it("réactive en ACTIVE seulement avec une coordonnée vérifiée", () => {
    expect(statusForDecision("REACTIVATE", "SUSPENDED", true)).toBe("ACTIVE")
    expect(statusForDecision("REACTIVATE", "BANNED", false)).toBe("PENDING")
  })

  it("refuse les transitions incohérentes", () => {
    expect(statusForDecision("REACTIVATE", "ACTIVE", true)).toBeNull()
    expect(statusForDecision("SUSPEND", "BANNED", true)).toBeNull()
    expect(statusForDecision("BAN", "SUSPENDED", true)).toBe("BANNED")
  })
})

describe("règles de modération", () => {
  const types: ListingType[] = ["SALE", "RENT"]

  it("chaque décision est une transition de la machine à états Listing, avec la même permission", () => {
    for (const decision of MODERATION_DECISIONS) {
      const rule = MODERATION_RULES[decision]
      for (const from of rule.from) {
        for (const type of types) {
          const actors = transitionActors(from, rule.to, type)
          expect(
            actors.some(
              (entry) =>
                entry.kind === "moderator" &&
                entry.permission === rule.permission,
            ),
          ).toBe(true)
        }
      }
    }
  })

  it("propose les décisions selon le statut et les permissions", () => {
    expect(availableDecisions(actor("MODERATOR"), "PENDING_REVIEW")).toEqual([
      "APPROVE",
      "REJECT",
      "REQUEST_CHANGES",
    ])
    expect(availableDecisions(actor("MODERATOR"), "PUBLISHED")).toEqual([
      "SUSPEND",
    ])
    expect(availableDecisions(actor("SUPPORT"), "PENDING_REVIEW")).toEqual([])
    expect(availableDecisions(actor("ADMIN"), "SUSPENDED")).toEqual(["RESTORE"])
  })

  it("n'expose jamais la note interne au propriétaire", () => {
    const notice = moderationNotice(
      "REJECT",
      "Villa à Cocody",
      "Photos non conformes.",
      null,
    )
    expect(notice.title).toBe("Annonce refusée")
    expect(notice.body).toContain("Villa à Cocody")
    expect(notice.body).toContain("Photos non conformes.")
    expect(historyReason("PHOTOS_QUALITY", null)).toBe("PHOTOS_QUALITY")
    expect(historyReason(null, "  ")).toBeNull()
  })
})

describe("contrôles de cohérence", () => {
  const facts: ListingFacts = {
    hasCurrentPrice: true,
    photoCount: CHECK_THRESHOLDS.minPhotos,
    descriptionLength: CHECK_THRESHOLDS.minDescriptionLength,
    propertyActive: true,
    openReports: 0,
    openSignals: 0,
    publisherIdentityVerified: true,
    pricePerSqm: 100_000,
    comparablePricePerSqm: { median: 100_000, count: 10 },
  }
  const outcome = (input: ListingFacts, check: string) =>
    consistencyChecks(input).find((entry) => entry.code === check)?.outcome

  it("tout passe sur une annonce complète", () => {
    expect(
      consistencyChecks(facts).every((entry) => entry.outcome === "PASS"),
    ).toBe(true)
  })

  it("signale sans conclure : prix atypique, signalements, photos", () => {
    expect(outcome({ ...facts, pricePerSqm: 30_000 }, "PRICE_PER_SQM")).toBe(
      "WARN",
    )
    expect(outcome({ ...facts, openReports: 2 }, "OPEN_REPORTS")).toBe("WARN")
    expect(outcome({ ...facts, photoCount: 1 }, "PHOTOS")).toBe("WARN")
  })

  it("ne juge pas le prix sans comparables suffisants", () => {
    expect(
      outcome(
        { ...facts, comparablePricePerSqm: { median: 100_000, count: 2 } },
        "PRICE_PER_SQM",
      ),
    ).toBe("UNKNOWN")
    expect(
      outcome({ ...facts, comparablePricePerSqm: null }, "PRICE_PER_SQM"),
    ).toBe("UNKNOWN")
  })
})

describe("données sensibles", () => {
  it("masque les coordonnées", () => {
    expect(maskEmail("jean.dupont@example.com")).toBe("j***@example.com")
    expect(maskPhone("+2250700000012")).toBe("+225********12")
    expect(maskEmail(null)).toBeNull()
  })

  it("masque les secrets dans les valeurs d'audit, à toute profondeur", () => {
    expect(
      redactAuditValues({
        role: "MODERATOR",
        passwordHash: "x",
        nested: [{ refreshToken: "y", otpCode: "1", note: "ok" }],
      }),
    ).toEqual({
      role: "MODERATOR",
      passwordHash: "[masqué]",
      nested: [{ refreshToken: "[masqué]", otpCode: "[masqué]", note: "ok" }],
    })
  })
})
