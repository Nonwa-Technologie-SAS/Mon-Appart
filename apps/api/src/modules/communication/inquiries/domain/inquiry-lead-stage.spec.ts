import { describe, expect, it } from "vitest"

import {
  canTransitionInquiryStage,
  suggestedStageAfterFirstReply,
  suggestedStageAfterVisit,
} from "./inquiry-lead-stage"
import { prioritizeInquiry } from "./inquiry-priority"

describe("inquiry-lead-stage", () => {
  it("interdit NEW → CONVERTED", () => {
    expect(canTransitionInquiryStage("NEW", "CONVERTED")).toBe(false)
  })

  it("autorise QUALIFIED → VISIT_PLANNED", () => {
    expect(canTransitionInquiryStage("QUALIFIED", "VISIT_PLANNED")).toBe(true)
  })

  it("suggère CONTACTED après première réponse si NEW", () => {
    expect(suggestedStageAfterFirstReply("NEW")).toBe("CONTACTED")
    expect(suggestedStageAfterFirstReply("QUALIFIED")).toBeNull()
  })

  it("suggère VISIT_PLANNED après confirmation", () => {
    expect(suggestedStageAfterVisit("CONTACTED", "CONFIRMED")).toBe(
      "VISIT_PLANNED",
    )
    expect(suggestedStageAfterVisit("VISIT_PLANNED", "COMPLETED")).toBe(
      "VISIT_DONE",
    )
  })
})

describe("inquiry-priority", () => {
  const now = new Date("2026-10-23T12:00:00Z")

  it("classe HIGH une visite en attente + sans réponse", () => {
    const result = prioritizeInquiry({
      stage: "NEW",
      status: "OPEN",
      createdAt: new Date("2026-10-21T12:00:00Z"),
      nextActionAt: null,
      budgetAmount: null,
      listingPrice: null,
      hasPendingVisit: true,
      hasConfirmedVisit: false,
      firstRespondedAt: null,
      now,
    })
    expect(result.priority).toBe("HIGH")
    expect(result.reasons.some((r) => r.includes("visite"))).toBe(true)
    expect(result.suggestedAction).toMatch(/Confirmer/i)
  })

  it("ne déduit pas la solvabilité d'un budget", () => {
    const result = prioritizeInquiry({
      stage: "CONTACTED",
      status: "IN_PROGRESS",
      createdAt: now,
      nextActionAt: null,
      budgetAmount: 50_000n,
      listingPrice: 500_000n,
      hasPendingVisit: false,
      hasConfirmedVisit: false,
      firstRespondedAt: now,
      now,
    })
    expect(result.reasons.join(" ")).not.toMatch(/solvable|fiable/i)
  })

  it("signale une prochaine action échue sans classer HIGH seul", () => {
    const result = prioritizeInquiry({
      stage: "FOLLOW_UP",
      status: "IN_PROGRESS",
      createdAt: now,
      nextActionAt: new Date("2026-10-22T12:00:00Z"),
      budgetAmount: null,
      listingPrice: null,
      hasPendingVisit: false,
      hasConfirmedVisit: false,
      firstRespondedAt: now,
      now,
    })
    expect(result.priority).toBe("LOW")
    expect(result.reasons.some((r) => r.includes("échue"))).toBe(true)
    expect(result.suggestedAction).toMatch(/prochaine action/i)
  })

  it("indique un budget proche du prix affiché", () => {
    const result = prioritizeInquiry({
      stage: "QUALIFIED",
      status: "IN_PROGRESS",
      createdAt: now,
      nextActionAt: null,
      budgetAmount: 240_000n,
      listingPrice: 250_000n,
      hasPendingVisit: false,
      hasConfirmedVisit: false,
      firstRespondedAt: now,
      now,
    })
    expect(result.reasons.some((r) => r.includes("Budget déclaré"))).toBe(true)
  })
})
