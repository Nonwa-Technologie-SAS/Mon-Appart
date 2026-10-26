import { describe, expect, it } from "vitest"

import {
  assertSupplyLeadStageTransition,
  canTransitionSupplyLeadStage,
  isActivatedStage,
} from "./supply-lead-pipeline"

describe("supply-lead-pipeline", () => {
  it("refuse de compter REGISTERED comme activé", () => {
    expect(isActivatedStage("REGISTERED")).toBe(false)
    expect(isActivatedStage("ACTIVATED")).toBe(true)
  })

  it("autorise IDENTIFIED → TO_CONTACT → CONTACTED", () => {
    expect(canTransitionSupplyLeadStage("IDENTIFIED", "TO_CONTACT")).toBe(true)
    expect(canTransitionSupplyLeadStage("TO_CONTACT", "CONTACTED")).toBe(true)
  })

  it("interdit un saut IDENTIFIED → ACTIVATED", () => {
    expect(canTransitionSupplyLeadStage("IDENTIFIED", "ACTIVATED")).toBe(false)
    expect(() =>
      assertSupplyLeadStageTransition("IDENTIFIED", "ACTIVATED"),
    ).toThrow(/interdite/)
  })

  it("permet de réouvrir un REFUSED", () => {
    expect(canTransitionSupplyLeadStage("REFUSED", "TO_CONTACT")).toBe(true)
  })
})
