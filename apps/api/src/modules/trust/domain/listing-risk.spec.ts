import { describe, expect, it } from "vitest"

import {
  assessListingRisk,
  isolatedSignalBlocksNothing,
  isMaterialListingChange,
} from "./listing-risk"

describe("listing-risk", () => {
  it("ne traite pas une date d'expiration comme un changement notable", () => {
    expect(isMaterialListingChange(["expiresAt"])).toBe(false)
    expect(isMaterialListingChange(["title"])).toBe(true)
  })

  it("un signal isolé ne justifie aucune sanction automatique", () => {
    const assessment = assessListingRisk({
      openSignals: [{ rule: "PRICE_CHANGE_ANOMALY", severity: "HIGH" }],
      distinctReporters: 0,
      confirmedIncidents: 0,
    })
    expect(assessment.level).toBe("HIGH")
    expect(assessment.humanReviewRequired).toBe(true)
    expect(isolatedSignalBlocksNothing(assessment.signals)).toBe(true)
  })

  it("plusieurs signaux HIGH avec un incident confirmé montent en CRITICAL", () => {
    const assessment = assessListingRisk({
      openSignals: [
        { rule: "DUPLICATE_MEDIA_CROSS_ACCOUNT", severity: "HIGH" },
        { rule: "MESSAGE_FAKE_SUPPORT", severity: "HIGH" },
      ],
      distinctReporters: 1,
      confirmedIncidents: 1,
    })
    expect(assessment.level).toBe("CRITICAL")
    expect(assessment.recommendedAction).toBe("PROTECT")
  })

  it("sans signal ni signalement, le parcours reste normal", () => {
    expect(
      assessListingRisk({
        openSignals: [],
        distinctReporters: 0,
        confirmedIncidents: 0,
      }).recommendedAction,
    ).toBe("MONITOR")
  })
})
