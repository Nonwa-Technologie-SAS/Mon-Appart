import { describe, expect, it } from "vitest"

import { extractCriteria } from "./criteria-extractor"
import { criteriaToSearchParams } from "./criteria-to-search"

describe("criteriaToSearchParams", () => {
  it("mappe les filtres stricts vers Search", () => {
    const c = extractCriteria(
      "Maison 3 chambres à louer Cocody max 250000 par mois parking",
    )
    const p = criteriaToSearchParams(c)
    expect(p.listingType).toContain("RENT")
    expect(p.propertyType).toContain("HOUSE")
    expect(p.commune).toContain("COCODY")
    expect(p.maxPrice).toBe("250000")
    expect(p.bedrooms).toBe("3")
    expect(p.amenities).toContain("PARKING")
    expect(p.amenitiesMode).toBe("AND")
  })
})
