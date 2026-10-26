import { describe, expect, it } from "vitest"

import { classifyLifecycle, isReactivationEligible } from "./user-lifecycle"

const now = new Date("2026-10-23T12:00:00Z")

describe("classifyLifecycle", () => {
  it("respecte un projet déclaré terminé", () => {
    expect(
      classifyLifecycle({
        projectStatus: "COMPLETED",
        isPublisher: false,
        hasUpcomingVisit: true,
        hasCompletedVisitWithoutFeedback: true,
        savedSearchCount: 2,
        favoriteCount: 1,
        recentSearchCount: 3,
        lastLoginAt: now,
        now,
      }),
    ).toBe("PROJECT_COMPLETED")
  })

  it("ne déduit pas un succès d'une inactivité", () => {
    expect(
      classifyLifecycle({
        projectStatus: "ACTIVE",
        isPublisher: false,
        hasUpcomingVisit: false,
        hasCompletedVisitWithoutFeedback: false,
        savedSearchCount: 0,
        favoriteCount: 0,
        recentSearchCount: 0,
        lastLoginAt: new Date("2026-01-01T00:00:00Z"),
        now,
      }),
    ).toBe("EXPLORATORY")
  })

  it("classe une visite à venir en phase de visite", () => {
    expect(
      classifyLifecycle({
        projectStatus: "ACTIVE",
        isPublisher: false,
        hasUpcomingVisit: true,
        hasCompletedVisitWithoutFeedback: false,
        savedSearchCount: 0,
        favoriteCount: 0,
        recentSearchCount: 0,
        lastLoginAt: now,
        now,
      }),
    ).toBe("VISIT_PHASE")
  })
})

describe("isReactivationEligible", () => {
  it("exige des correspondances exactes et un cooldown", () => {
    expect(
      isReactivationEligible({
        projectStatus: "ACTIVE",
        lastLoginAt: new Date("2026-10-01T00:00:00Z"),
        lastReactivationAt: null,
        alertsEnabled: true,
        hasExactMatches: true,
        idleDays: 7,
        cooldownDays: 14,
        now,
      }).eligible,
    ).toBe(true)
    expect(
      isReactivationEligible({
        projectStatus: "COMPLETED",
        lastLoginAt: new Date("2026-10-01T00:00:00Z"),
        lastReactivationAt: null,
        alertsEnabled: true,
        hasExactMatches: true,
        idleDays: 7,
        cooldownDays: 14,
        now,
      }).eligible,
    ).toBe(false)
    expect(
      isReactivationEligible({
        projectStatus: "ACTIVE",
        lastLoginAt: new Date("2026-10-01T00:00:00Z"),
        lastReactivationAt: null,
        alertsEnabled: true,
        hasExactMatches: false,
        idleDays: 7,
        cooldownDays: 14,
        now,
      }).eligible,
    ).toBe(false)
  })

  it("n'envoie rien si le projet est en pause déclarée", () => {
    expect(
      isReactivationEligible({
        projectStatus: "PAUSED",
        lastLoginAt: new Date("2026-10-01T00:00:00Z"),
        lastReactivationAt: null,
        alertsEnabled: true,
        hasExactMatches: true,
        idleDays: 7,
        cooldownDays: 14,
        now,
      }).eligible,
    ).toBe(false)
  })

  it("respecte le cooldown après une campagne", () => {
    expect(
      isReactivationEligible({
        projectStatus: "ACTIVE",
        lastLoginAt: new Date("2026-10-01T00:00:00Z"),
        lastReactivationAt: new Date("2026-10-20T00:00:00Z"),
        alertsEnabled: true,
        hasExactMatches: true,
        idleDays: 7,
        cooldownDays: 14,
        now,
      }).eligible,
    ).toBe(false)
  })
})
