import { describe, expect, it } from "vitest"

import { extractCriteria, mergeCriteria } from "./criteria-extractor"

describe("extractCriteria — FR Côte d’Ivoire", () => {
  it("extrait location maison Cocody budget mensuel et chambres", () => {
    const c = extractCriteria(
      "Je cherche une maison de 3 chambres à louer à Cocody, budget 250 000 FCFA par mois maximum. Quartier calme, emménager rapidement.",
    )
    expect(c.listingTypes).toContain("RENT")
    expect(c.propertyTypes).toContain("HOUSE")
    expect(c.communes).toContain("COCODY")
    expect(c.bedroomsMin).toBe(3)
    expect(c.priceMax).toBe(250_000)
    expect(c.pricePeriod).toBe("MONTH")
    expect(c.softPreferences).toContain("CALM_AREA")
    expect(c.softPreferences).toContain("QUICK_MOVE_IN")
    expect(c.unverifiableHints.length).toBeGreaterThan(0)
    expect(c.clarificationQuestion).toBeNull()
  })

  it("demande clarification pour un terrain sans opération", () => {
    const c = extractCriteria("Je cherche un terrain à Cocody.")
    expect(c.propertyTypes).toContain("LAND")
    expect(c.communes).toContain("COCODY")
    expect(c.clarificationQuestion).toMatch(/acheter|louer/i)
  })

  it("demande la commune pour Abidjan, puis le budget si besoin", () => {
    const c = extractCriteria("Je veux louer un appartement à Abidjan.")
    expect(c.listingTypes).toContain("RENT")
    expect(c.propertyTypes).toContain("APARTMENT")
    expect(c.cities).toContain("ABIDJAN")
    expect(c.clarificationQuestion).toMatch(/commune|quartier/i)

    const withCommune = mergeCriteria(c, "Cocody")
    expect(withCommune.communes).toContain("COCODY")
    expect(withCommune.clarificationQuestion).toMatch(/budget/i)
  })

  it("reconnaît Angré et Riviera", () => {
    const angre = extractCriteria("Studio à Angré à louer")
    expect(angre.neighborhoods).toContain("ANGRE")
    expect(angre.communes).toContain("COCODY")
    const riviera = extractCriteria("Villa Riviera location")
    expect(riviera.neighborhoods).toContain("RIVIERA")
  })

  it("parse 250k et 1.5M", () => {
    expect(extractCriteria("louer max 250k").priceMax).toBe(250_000)
    expect(extractCriteria("acheter maison 45M Cocody").priceMax).toBe(
      45_000_000,
    )
  })
})

describe("mergeCriteria", () => {
  it("conserve Cocody et ajoute le budget", () => {
    const base = extractCriteria("appartement à louer Cocody")
    const merged = mergeCriteria(base, "budget max 300000 par mois")
    expect(merged.communes).toContain("COCODY")
    expect(merged.listingTypes).toContain("RENT")
    expect(merged.priceMax).toBe(300_000)
    expect(merged.pricePeriod).toBe("MONTH")
  })

  it("autorise la recherche sans budget", () => {
    const base = extractCriteria("appartement à louer Cocody")
    const merged = mergeCriteria(base, "sans budget")
    expect(merged.priceMax).toBeNull()
  })
})
