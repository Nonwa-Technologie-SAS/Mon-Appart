import { describe, expect, it } from "vitest"

import {
  attributeDiversity,
  averagePrecisionAtK,
  catalogCoverage,
  ndcgAtK,
  precisionAtK,
  recallAtK,
} from "./evaluation-metrics"

describe("evaluation-metrics (hors ligne)", () => {
  const ranked = [
    { id: "a", relevance: 1 },
    { id: "b", relevance: 0 },
    { id: "c", relevance: 1 },
    { id: "d", relevance: 0 },
  ]

  it("precision@2", () => {
    expect(precisionAtK(ranked, 2)).toBe(0.5)
    expect(precisionAtK(ranked, 3)).toBeCloseTo(2 / 3)
  })

  it("recall@3", () => {
    expect(recallAtK(ranked, new Set(["a", "c", "x"]), 3)).toBeCloseTo(2 / 3)
  })

  it("ndcg@3 est dans [0,1] et favorise le bon ordre", () => {
    const good = [
      { id: "a", relevance: 3 },
      { id: "b", relevance: 2 },
      { id: "c", relevance: 1 },
    ]
    const bad = [
      { id: "c", relevance: 1 },
      { id: "b", relevance: 2 },
      { id: "a", relevance: 3 },
    ]
    expect(ndcgAtK(good, 3)).toBeGreaterThan(ndcgAtK(bad, 3))
    expect(ndcgAtK(good, 3)).toBeLessThanOrEqual(1)
  })

  it("average precision favorise les hits en tête", () => {
    const good = [
      { id: "a", relevance: 1 },
      { id: "b", relevance: 0 },
      { id: "c", relevance: 1 },
    ]
    const bad = [
      { id: "b", relevance: 0 },
      { id: "c", relevance: 1 },
      { id: "a", relevance: 1 },
    ]
    expect(averagePrecisionAtK(good, 3)).toBeGreaterThan(
      averagePrecisionAtK(bad, 3),
    )
  })

  it("couverture et diversité", () => {
    expect(
      catalogCoverage(["a", "b", "a"], new Set(["a", "b", "c"])),
    ).toBeCloseTo(2 / 3)
    expect(attributeDiversity(["COCODY", "COCODY", "MARCORY"])).toBeCloseTo(
      1 - 2 / 3,
    )
  })
})
