import { describe, expect, it } from "vitest"

import { CsvPropertyFeedAdapter } from "./csv-feed.adapter"

const HEADER =
  "externalListingId,title,listingType,propertyTypeCode,communeCode,amount,pricePeriod,bedrooms,surface,description"

describe("CsvPropertyFeedAdapter", () => {
  const adapter = new CsvPropertyFeedAdapter()

  it("accepte une ligne valide en XOF / location mensuelle", () => {
    const csv = `${HEADER}\nEXT-1,Appart Cocody,RENT,APARTMENT,ABIDJAN_COCODY,250000,MONTH,2,75,Belle vue`
    const report = adapter.parse(csv)
    expect(report.errors).toEqual([])
    expect(report.accepted).toHaveLength(1)
    expect(report.accepted[0]?.amount).toBe(250_000)
    expect(report.accepted[0]?.currency).toBe("XOF")
  })

  it("rejette vente avec période mensuelle", () => {
    const csv = `${HEADER}\nEXT-2,Villa,SALE,VILLA,ABIDJAN_PLATEAU,80000000,MONTH,,,`
    const report = adapter.parse(csv)
    expect(report.accepted).toHaveLength(0)
    expect(report.errors.some((e) => e.code === "INCOMPATIBLE")).toBe(true)
  })

  it("détecte les doublons d'identifiant externe", () => {
    const csv = `${HEADER}\nEXT-1,A,RENT,APARTMENT,ABIDJAN_COCODY,100000,MONTH,,,\nEXT-1,B,RENT,APARTMENT,ABIDJAN_COCODY,100000,MONTH,,,`
    const report = adapter.parse(csv)
    expect(report.duplicateExternalIds).toContain("EXT-1")
  })

  it("refuse un fichier sans colonnes obligatoires", () => {
    const report = adapter.parse("title,amount\nFoo,1")
    expect(report.errors.some((e) => e.code === "MISSING_COLUMN")).toBe(true)
  })
})
