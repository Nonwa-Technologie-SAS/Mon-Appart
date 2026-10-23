import { describe, expect, it } from "vitest"

import { extractCriteria } from "./criteria-extractor"
import { ASSISTANT_EVAL_CASES } from "./eval-dataset"
import { looksLikePromptInjection } from "./output-sanitize"

describe("jeu golden assistant (synthétique)", () => {
  it("marque tous les cas comme synthétiques", () => {
    expect(ASSISTANT_EVAL_CASES.every((row) => row.synthetic)).toBe(true)
  })

  it("extrait les critères des recherches représentatives", () => {
    for (const row of ASSISTANT_EVAL_CASES) {
      if (row.expect.kind !== "extract") continue
      const criteria = extractCriteria(row.query)
      if (row.expect.listingType) {
        expect(criteria.listingTypes).toContain(row.expect.listingType)
      }
      if (row.expect.propertyType) {
        expect(criteria.propertyTypes).toContain(row.expect.propertyType)
      }
      if (row.expect.commune) {
        expect(criteria.communes).toContain(row.expect.commune)
      }
      if (row.expect.hasBudget) {
        expect(criteria.priceMax).not.toBeNull()
      } else {
        expect(criteria.priceMax).toBeNull()
      }
      if (row.expect.clarify) {
        expect(criteria.clarificationQuestion).toBeTruthy()
      }
      expect(criteria.listingTypes.every((type) => type !== undefined)).toBe(
        true,
      )
    }
  })

  it("signale l’injection sans inventer d’annonce", () => {
    const row = ASSISTANT_EVAL_CASES.find((item) => item.id === "injection")!
    expect(looksLikePromptInjection(row.query)).toBe(true)
    const criteria = extractCriteria(row.query)
    expect(criteria.listingTypes).toEqual([])
    expect(criteria.priceMax).toBeNull()
  })

  it("n’extrait pas de coordonnées sur une demande privée", () => {
    const row = ASSISTANT_EVAL_CASES.find((item) => item.id === "privacy")!
    const criteria = extractCriteria(row.query)
    expect(criteria.freeText ?? "").not.toMatch(/@/)
    expect(JSON.stringify(criteria)).not.toMatch(/owner@/)
  })
})
