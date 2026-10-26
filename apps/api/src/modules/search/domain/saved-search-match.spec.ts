import { describe, expect, it } from "vitest"

import {
  digestDedupKey,
  hasAlertableCriteria,
  matchListingToSavedSearch,
  sanitizeSavedSearchParams,
  type ListingMatchInput,
  type SavedSearchCriteria,
} from "./saved-search-match"

const listing: ListingMatchInput = {
  status: "PUBLISHED",
  deletedAt: null,
  expiresAt: null,
  publishedAt: new Date("2026-10-20T10:00:00Z"),
  listingType: "RENT",
  propertyTypeCode: "APARTMENT",
  cityCode: "abidjan",
  communeCode: "cocody",
  neighborhoodCode: "riviera",
  priceAmount: 200_000,
  bedrooms: 2,
  bathrooms: 1,
  surface: 70,
  now: new Date("2026-10-23T10:00:00Z"),
}

const criteria: SavedSearchCriteria = {
  listingTypes: ["RENT"],
  propertyTypes: ["APARTMENT"],
  cities: [],
  communes: ["cocody"],
  neighborhoods: [],
  minPrice: null,
  maxPrice: 250_000,
  minSurface: null,
  maxSurface: null,
  minBedrooms: 2,
  minBathrooms: null,
}

describe("matchListingToSavedSearch", () => {
  it("classe exacte une annonce publiée dans les critères", () => {
    expect(matchListingToSavedSearch(listing, criteria).kind).toBe("exact")
  })

  it("exclut une annonce indisponible", () => {
    expect(
      matchListingToSavedSearch({ ...listing, status: "PAUSED" }, criteria)
        .kind,
    ).toBe("ineligible")
    expect(
      matchListingToSavedSearch({ ...listing, deletedAt: new Date() }, criteria)
        .kind,
    ).toBe("ineligible")
    expect(
      matchListingToSavedSearch(
        { ...listing, expiresAt: new Date("2026-10-22T00:00:00Z") },
        criteria,
      ).kind,
    ).toBe("ineligible")
  })

  it("ne présente jamais un dépassement de budget comme compatible", () => {
    const near = matchListingToSavedSearch(
      { ...listing, priceAmount: 280_000 },
      criteria,
    )
    expect(near.kind).toBe("near_budget")
    expect(near.overBudgetAmount).toBe(30_000)
    expect(
      matchListingToSavedSearch({ ...listing, priceAmount: 400_000 }, criteria)
        .kind,
    ).toBe("mismatch")
  })

  it("refuse une commune différente", () => {
    expect(
      matchListingToSavedSearch(
        { ...listing, communeCode: "yopougon" },
        criteria,
      ).kind,
    ).toBe("mismatch")
  })
})

describe("sanitizeSavedSearchParams", () => {
  it("ignore les clés non autorisées et le vide", () => {
    expect(
      sanitizeSavedSearchParams({
        listingType: "RENT",
        cursor: "abc",
        submit: "true",
        q: "  ",
        maxPrice: "200000",
      }),
    ).toEqual({ listingType: "RENT", maxPrice: "200000" })
  })
})

describe("hasAlertableCriteria", () => {
  it("exige un filtre structuré pour les alertes", () => {
    expect(
      hasAlertableCriteria({
        listingTypes: [],
        propertyTypes: [],
        cities: [],
        communes: [],
        neighborhoods: [],
        minPrice: null,
        maxPrice: null,
        minSurface: null,
        maxSurface: null,
        minBedrooms: null,
        minBathrooms: null,
      }),
    ).toBe(false)
    expect(hasAlertableCriteria(criteria)).toBe(true)
  })
})

describe("digestDedupKey", () => {
  it("est stable pour une même période", () => {
    const key = digestDedupKey(
      "6f1c2f5e-8a4b-4c1d-9e2f-3a4b5c6d7e8f",
      "2026-10-23",
    )
    expect(key).toBe(
      "saved-search:6f1c2f5e-8a4b-4c1d-9e2f-3a4b5c6d7e8f:digest:2026-10-23",
    )
  })
})
