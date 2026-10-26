import { describe, expect, it } from "vitest"

import {
  isVisitFeedbackOutcome,
  outcomeCompletesProject,
  outcomePausesSearch,
  ownerVisibleOutcome,
  reasonImpliesListingUnfit,
} from "./visit-feedback"

describe("visit-feedback", () => {
  it("n'expose l'issue au propriétaire que si partagée", () => {
    expect(
      ownerVisibleOutcome({
        shareOutcomeWithOwner: false,
        outcome: "NOT_A_FIT",
      }),
    ).toBeNull()
    expect(
      ownerVisibleOutcome({
        shareOutcomeWithOwner: true,
        outcome: "STILL_INTERESTED",
      }),
    ).toBe("STILL_INTERESTED")
  })

  it("termine le projet uniquement sur déclaration", () => {
    expect(outcomeCompletesProject("PROJECT_COMPLETED")).toBe(true)
    expect(outcomeCompletesProject("NOT_A_FIT")).toBe(false)
    expect(outcomePausesSearch("PROJECT_ABANDONED")).toBe(true)
  })

  it("un refus n'implique pas un rejet global", () => {
    expect(reasonImpliesListingUnfit("NOT_A_FIT")).toBe(true)
    expect(isVisitFeedbackOutcome("STILL_INTERESTED")).toBe(true)
    expect(isVisitFeedbackOutcome("SOLD")).toBe(false)
  })
})
