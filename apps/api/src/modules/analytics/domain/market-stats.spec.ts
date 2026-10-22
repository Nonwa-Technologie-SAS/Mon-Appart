import { describe, expect, it } from "vitest"

import {
  applySupplyThreshold,
  percentileSorted,
  type SupplyBucket,
} from "./market-stats"

describe("market-stats", () => {
  it("calcule médiane et percentiles", () => {
    const values = [100, 200, 300, 400, 500]
    expect(percentileSorted(values, 0.5)).toBe(300)
    expect(percentileSorted(values, 0.25)).toBe(200)
    expect(percentileSorted([], 0.5)).toBeNull()
  })

  it("masque les petits groupes de communes", () => {
    const buckets: SupplyBucket[] = [
      {
        commune: "COCODY",
        listingType: "RENT",
        propertyType: "APARTMENT",
        period: "MONTH",
        listings: 12,
        median: 200_000,
        p25: 150_000,
        p75: 250_000,
      },
      {
        commune: "TINY",
        listingType: "RENT",
        propertyType: "STUDIO",
        period: "MONTH",
        listings: 2,
        median: 80_000,
        p25: 70_000,
        p75: 90_000,
      },
    ]
    const { kept, suppressedGroups } = applySupplyThreshold(buckets, 5)
    expect(suppressedGroups).toBe(1)
    expect(kept.some((b) => b.commune === "COCODY")).toBe(true)
    expect(kept.some((b) => b.commune === "TINY")).toBe(false)
  })
})
