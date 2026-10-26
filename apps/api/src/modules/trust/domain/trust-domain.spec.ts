import { describe, expect, it } from "vitest"

import type { Role } from "@mon-appart/types"

import type { Actor } from "../../identity"
import {
  BADGE_DISCLAIMER,
  BADGE_LABELS,
  listingBadges,
  userBadges,
  type VerificationFact,
} from "./badges"
import {
  missingPublicationRequirements,
  parsePublicationRequirements,
} from "./publication-requirements"
import { reasonMessage, REJECTION_REASON_CODES } from "./reason-codes"
import { assertCanReview, assertIndependentReviewer } from "./review-policy"
import {
  isListingBurst,
  isPriceChangeAnomaly,
  reportThresholdReached,
  RiskRule,
  RULE_SEVERITY,
  runPrechecks,
  type PrecheckInput,
} from "./risk-rules"
import { verificationNotice } from "./trust-notifications"
import { computeTrustScore, type TrustScoreFacts } from "./trust-score"
import {
  documentRequirement,
  expiryFor,
  isRequestableType,
  missingDocumentGroups,
} from "./verification-requirements"
import {
  canTransitionVerification,
  isValidVerification,
} from "./verification-status"

const NOW = new Date("2026-10-12T12:00:00Z")
const DAY = 86_400_000

function codeOf(run: () => unknown): string | undefined {
  try {
    run()
    return undefined
  } catch (error) {
    return (error as { code?: string }).code
  }
}

function actor(roles: Role[], permissions: string[], userId = 10n): Actor {
  return {
    userId,
    publicId: "00000000-0000-4000-8000-000000000010",
    roles,
    permissions: new Set(permissions),
  }
}

function fact(overrides: Partial<VerificationFact>): VerificationFact {
  return {
    type: "IDENTITY",
    status: "VERIFIED",
    userId: 1n,
    propertyId: null,
    listingId: null,
    claimedRelation: null,
    verifiedAt: new Date(NOW.getTime() - 10 * DAY),
    decidedAt: new Date(NOW.getTime() - 10 * DAY),
    expiresAt: new Date(NOW.getTime() + 100 * DAY),
    ...overrides,
  }
}

describe("cycle de vie d'un dossier", () => {
  it("un brouillon ne peut pas être approuvé directement", () => {
    expect(canTransitionVerification("DRAFT", "VERIFIED")).toBe(false)
    expect(canTransitionVerification("DRAFT", "PENDING")).toBe(true)
  })

  it("un complément demandé repasse par une soumission, pas par une décision", () => {
    expect(
      canTransitionVerification("NEEDS_MORE_INFORMATION", "VERIFIED"),
    ).toBe(false)
    expect(canTransitionVerification("NEEDS_MORE_INFORMATION", "PENDING")).toBe(
      true,
    )
  })

  it("une décision rendue est finale, sauf révocation ou expiration", () => {
    expect(canTransitionVerification("REJECTED", "VERIFIED")).toBe(false)
    expect(canTransitionVerification("VERIFIED", "REVOKED")).toBe(true)
    expect(canTransitionVerification("VERIFIED", "EXPIRED")).toBe(true)
    expect(canTransitionVerification("REVOKED", "VERIFIED")).toBe(false)
  })

  it("seul un dossier approuvé et non échu est valide", () => {
    expect(
      isValidVerification({ status: "VERIFIED", expiresAt: null }, NOW),
    ).toBe(true)
    expect(
      isValidVerification(
        { status: "VERIFIED", expiresAt: new Date(NOW.getTime() - 1) },
        NOW,
      ),
    ).toBe(false)
    expect(
      isValidVerification({ status: "PENDING", expiresAt: null }, NOW),
    ).toBe(false)
  })
})

describe("exigences documentaires", () => {
  it("téléphone et e-mail ne se demandent pas ici", () => {
    expect(isRequestableType("PHONE")).toBe(false)
    expect(isRequestableType("EMAIL")).toBe(false)
    expect(isRequestableType("IDENTITY")).toBe(true)
  })

  it("un terrain exige un titre foncier, pas un permis de construire seul", () => {
    const land = documentRequirement("PROPERTY_OWNERSHIP", "LAND")
    expect(missingDocumentGroups(land, ["BUILDING_PERMIT"])).toHaveLength(1)
    expect(missingDocumentGroups(land, ["CONCESSION_DECREE"])).toHaveLength(0)
  })

  it("une facture seule ne prouve pas la propriété", () => {
    const house = documentRequirement("PROPERTY_OWNERSHIP", "RESIDENTIAL")
    expect(missingDocumentGroups(house, ["UTILITY_BILL"])).toHaveLength(1)
  })

  it("l'identité exige une pièce d'identité", () => {
    const identity = documentRequirement("IDENTITY", null)
    expect(missingDocumentGroups(identity, [])).toHaveLength(1)
    expect(missingDocumentGroups(identity, ["PASSPORT"])).toHaveLength(0)
    expect(identity.accepted).not.toContain("TITLE_DEED")
  })

  it("l'échéance dépend du type", () => {
    const validity = {
      identityDays: 730,
      propertyDays: 365,
      agencyDays: 365,
      listingCheckDays: 180,
    }
    expect(expiryFor("IDENTITY", NOW, validity).getTime()).toBe(
      NOW.getTime() + 730 * DAY,
    )
    expect(expiryFor("LISTING_CONSISTENCY", NOW, validity).getTime()).toBe(
      NOW.getTime() + 180 * DAY,
    )
  })
})

describe("badges", () => {
  it("aucun badge sans vérification approuvée", () => {
    const badges = userBadges(
      {
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        verifications: [
          fact({ status: "PENDING", verifiedAt: null }),
          fact({ status: "REJECTED", verifiedAt: null }),
        ],
      },
      NOW,
    )
    expect(badges).toEqual([])
  })

  it("une vérification échue ou révoquée ne donne pas de badge", () => {
    const badges = userBadges(
      {
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        verifications: [
          fact({ expiresAt: new Date(NOW.getTime() - DAY) }),
          fact({ status: "REVOKED" }),
        ],
      },
      NOW,
    )
    expect(badges).toEqual([])
  })

  it("le droit de publication disparaît quand le rattachement prend fin", () => {
    const right = fact({
      type: "OWNER_AUTHORIZATION",
      userId: 7n,
      propertyId: 3n,
      claimedRelation: "AGENT",
    })
    const facts = {
      listingId: 5n,
      propertyId: 3n,
      currentPriceSince: null,
      verifications: [right],
    }
    expect(
      listingBadges(
        { ...facts, relations: new Map([[7n, ["AGENT"]]]) },
        NOW,
      ).map((b) => b.code),
    ).toEqual(["PUBLICATION_RIGHT_VERIFIED"])
    expect(listingBadges({ ...facts, relations: new Map() }, NOW)).toEqual([])
  })

  it("un prix modifié après le contrôle invalide le badge d'annonce contrôlée", () => {
    const check = fact({
      type: "LISTING_CONSISTENCY",
      propertyId: 3n,
      listingId: 5n,
      decidedAt: new Date(NOW.getTime() - 5 * DAY),
    })
    const base = {
      listingId: 5n,
      propertyId: 3n,
      verifications: [check],
      relations: new Map(),
    }
    expect(
      listingBadges(
        { ...base, currentPriceSince: new Date(NOW.getTime() - 10 * DAY) },
        NOW,
      ).map((b) => b.code),
    ).toEqual(["LISTING_CHECKED"])
    expect(
      listingBadges(
        { ...base, currentPriceSince: new Date(NOW.getTime() - DAY) },
        NOW,
      ),
    ).toEqual([])
  })

  it("les libellés restent factuels, sans promesse de garantie", () => {
    const labels = Object.values(BADGE_LABELS).join(" ").toLowerCase()
    expect(labels).not.toMatch(/garanti|sans risque|certifi|sûr/)
    expect(BADGE_DISCLAIMER).toMatch(/ni une certification juridique/)
    expect(BADGE_DISCLAIMER).toMatch(/ni une garantie/)
  })
})

describe("score de confiance", () => {
  const empty: TrustScoreFacts = {
    phoneVerified: false,
    emailVerified: false,
    identityVerified: false,
    agencyVerified: false,
    publicationRightVerified: false,
    propertyDocumentsVerified: false,
    everReviewedApproved: false,
    confirmedReports: 0,
    revocations: 0,
  }

  it("un nouveau compte n'est pas noté (données insuffisantes), pas pénalisé", () => {
    const result = computeTrustScore({ ...empty, phoneVerified: true })
    expect(result.score).toBeNull()
    expect(result.isComplete).toBe(false)
  })

  it("le score ne dépend que de faits vérifiés et de décisions humaines", () => {
    const result = computeTrustScore({
      ...empty,
      phoneVerified: true,
      emailVerified: true,
      identityVerified: true,
      everReviewedApproved: true,
    })
    expect(result.score).toBe(60)
    expect(result.factors.map((f) => f.code)).not.toContain("VIEWS")
  })

  it("signalements confirmés et révocations réduisent le score, borné à 0", () => {
    const result = computeTrustScore({
      ...empty,
      identityVerified: true,
      everReviewedApproved: true,
      confirmedReports: 2,
      revocations: 1,
    })
    expect(result.score).toBe(0)
    expect(result.behaviorScore).toBe(0)
  })
})

describe("règles de risque", () => {
  const input: PrecheckInput = {
    requiredDocumentsCovered: true,
    unscannedDocuments: 1,
    phoneVerified: true,
    emailVerified: false,
    identityVerified: true,
    claimedRelation: "SOLE",
    currentRelations: ["SOLE"],
    duplicateUploaders: 0,
    otherSoleOwners: 0,
  }

  it("une pièce non analysée est un fait, pas une alerte", () => {
    const { prechecks, findings } = runPrechecks(input, NOW)
    expect(prechecks.unscannedDocuments).toBe(1)
    expect(findings).toEqual([])
  })

  it("doublon de fichier, rattachement absent et propriétaire concurrent lèvent des alertes", () => {
    const { findings } = runPrechecks(
      {
        ...input,
        duplicateUploaders: 1,
        currentRelations: [],
        otherSoleOwners: 1,
      },
      NOW,
    )
    expect(findings.map((f) => f.rule).sort()).toEqual([
      "CONFLICTING_OWNERSHIP",
      "DUPLICATE_DOCUMENT",
      "RELATION_NOT_ESTABLISHED",
    ])
  })

  it("seuil de signalements : déclarants distincts", () => {
    expect(reportThresholdReached(2, 3)).toBe(false)
    expect(reportThresholdReached(3, 3)).toBe(true)
  })

  it("variation de prix anormale", () => {
    expect(isPriceChangeAnomaly(100_000, 40_000, 0.5)).toBe(true)
    expect(isPriceChangeAnomaly(100_000, 80_000, 0.5)).toBe(false)
    expect(isPriceChangeAnomaly(0, 80_000, 0.5)).toBe(false)
  })

  it("pic de création d'annonces (revue, pas sanction)", () => {
    expect(isListingBurst(7, 8)).toBe(false)
    expect(isListingBurst(8, 8)).toBe(true)
    expect(isListingBurst(10, 0)).toBe(false)
  })

  it("chaque règle de risque a une sévérité explicite", () => {
    for (const rule of Object.values(RiskRule)) {
      expect(RULE_SEVERITY[rule]).toMatch(/^(LOW|MEDIUM|HIGH)$/)
    }
  })
})

describe("politique de relecture", () => {
  const moderator = actor(
    ["MODERATOR"],
    ["verification:read", "verification:review", "verification:documents"],
  )
  const officer = actor(
    ["TRUST_OFFICER"],
    [
      "verification:read",
      "verification:review",
      "verification:documents",
      "verification:approve",
      "verification:reject",
      "verification:revoke",
    ],
  )
  const admin = actor(
    ["ADMIN"],
    [
      "verification:read",
      "verification:review",
      "verification:approve",
      "verification:reject",
      "verification:revoke",
    ],
  )

  it("un modérateur instruit mais ne décide pas", () => {
    expect(
      codeOf(() => assertCanReview(moderator, "ASSIGN", true)),
    ).toBeUndefined()
    expect(codeOf(() => assertCanReview(moderator, "APPROVE", false))).toBe(
      "DECISION_PERMISSION_REQUIRED",
    )
  })

  it("un agent de confiance décide", () => {
    expect(
      codeOf(() => assertCanReview(officer, "APPROVE", true)),
    ).toBeUndefined()
    expect(
      codeOf(() => assertCanReview(officer, "REVOKE", false)),
    ).toBeUndefined()
  })

  it("un administrateur sans accès aux pièces ne décide pas sur pièces", () => {
    expect(codeOf(() => assertCanReview(admin, "APPROVE", true))).toBe(
      "DECISION_PERMISSION_REQUIRED",
    )
    expect(
      codeOf(() => assertCanReview(admin, "APPROVE", false)),
    ).toBeUndefined()
  })

  it("nul ne relit son propre dossier ni celui d'un bien auquel il est rattaché", () => {
    expect(
      codeOf(() =>
        assertIndependentReviewer(10n, {
          userId: 10n,
          reviewerIsLinkedToProperty: false,
        }),
      ),
    ).toBe("SELF_REVIEW_FORBIDDEN")
    expect(
      codeOf(() =>
        assertIndependentReviewer(10n, {
          userId: 11n,
          reviewerIsLinkedToProperty: true,
        }),
      ),
    ).toBe("CONFLICT_OF_INTEREST")
  })
})

describe("exigences de publication", () => {
  it("lecture tolérante de la configuration", () => {
    expect(parsePublicationRequirements(" identity, foo,IDENTITY ")).toEqual([
      "IDENTITY",
    ])
    expect(parsePublicationRequirements("")).toEqual([])
    expect(parsePublicationRequirements(undefined)).toEqual([])
  })

  it("liste les vérifications manquantes", () => {
    expect(
      missingPublicationRequirements(["IDENTITY", "PUBLICATION_RIGHT"], {
        publisherIdentityVerified: true,
        publicationRightVerified: false,
      }),
    ).toEqual(["PUBLICATION_RIGHT"])
  })
})

describe("motifs et notifications", () => {
  it("un code inconnu ne fuit pas tel quel", () => {
    expect(reasonMessage("FRAUD_SCORE_92")).not.toContain("FRAUD")
  })

  it("une notification de rejet ne contient que le motif public et le message", () => {
    for (const code of REJECTION_REASON_CODES) {
      const notice = verificationNotice.rejected("IDENTITY", code, null)
      expect(notice.body).toContain(reasonMessage(code)!)
      expect(notice.body.toLowerCase()).not.toMatch(/fraud|score|signal/)
    }
  })
})
