import { describe, expect, it } from "vitest"

import { SYNTHETIC_CANDIDATES, SYNTHETIC_LABELS } from "./eval-fixtures"
import {
  evaluateRecommendationOffline,
  rankByFreshness,
  rankByPopularity,
} from "./offline-eval"
import { syntheticRankingInput } from "./eval-fixtures"
import { rankWithRules } from "../../recommendation/domain/recommendation-engine"

describe("évaluation hors ligne (synthétique)", () => {
  it("marque le dataset comme synthétique", () => {
    const report = evaluateRecommendationOffline()
    expect(report.dataset.kind).toBe("synthetic")
    expect(report.engines.map((row) => row.name)).toEqual([
      "rules",
      "freshness",
      "popularity",
    ])
  })

  it("exclut l’annonce hors budget du classement rules-v1", () => {
    const over = SYNTHETIC_CANDIDATES.find(
      (row) => row.price.amount === 400_000,
    )
    expect(over).toBeDefined()
    const rules = rankWithRules(syntheticRankingInput())
    expect(
      rules.some((item) => item.candidate.listingId === over!.listingId),
    ).toBe(false)
    const slice = evaluateRecommendationOffline().engines.find(
      (row) => row.name === "rules",
    )
    expect(slice?.budgetViolationRate).toBe(0)
    expect(slice?.emptyRate).toBe(0)
  })

  it("ne confond pas popularité et pertinence labellisée", () => {
    const input = syntheticRankingInput()
    const popular = rankByPopularity(input)
    expect(popular[0]?.candidate.recentViews).toBeGreaterThan(
      popular[1]?.candidate.recentViews ?? 0,
    )
    const labeledContact = SYNTHETIC_LABELS.find((row) => row.relevance === 3)
    expect(labeledContact).toBeDefined()
    const rules = rankWithRules(input)
    const rulesTop = rules[0]?.candidate.publicId
    const popTop = popular[0]?.candidate.publicId
    expect(rulesTop).not.toBe(popTop)
  })

  it("limite la redondance d’un même propriétaire (MMR)", () => {
    const rules = rankWithRules(syntheticRankingInput())
    const owner1 = rules.filter((item) => item.candidate.createdById === 1n)
    expect(owner1.length).toBeLessThanOrEqual(2)
  })

  it("les raisons rules-v1 ne sont pas vides sur un match budget+type", () => {
    const rules = rankWithRules(syntheticRankingInput())
    const first = rules[0]
    expect(first).toBeDefined()
    expect(first!.reasons.length).toBeGreaterThan(0)
    expect(first!.reasons).not.toContain("SECRET")
  })

  it("la baseline fraîcheur trie réellement par date", () => {
    const freshness = rankByFreshness(syntheticRankingInput())
    const dates = freshness.map((item) => item.candidate.publishedAt.getTime())
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
  })
})
