import { describe, expect, it } from "vitest"

import { AI_SYSTEM_REGISTRY, getAiSystem } from "./ai-system-registry"

describe("inventaire IA", () => {
  it("identifiants uniques et aucun système critique auto-exécuté", () => {
    const ids = AI_SYSTEM_REGISTRY.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const row of AI_SYSTEM_REGISTRY) {
      expect(row.risk).not.toBe("critical")
      if (row.status === "stub") {
        expect(row.automation).toBe("none")
      }
    }
  })

  it("déclare le moteur distant comme stub, pas opérationnel", () => {
    const remote = getAiSystem("remote_ranker")
    expect(remote?.status).toBe("stub")
    expect(remote?.configOrModelVersion).toMatch(/health/)
  })

  it("classe Trust en risque élevé car impact visibilité", () => {
    expect(getAiSystem("trust_listing_risk")?.risk).toBe("high")
    expect(getAiSystem("recommendation")?.risk).toBe("moderate")
    expect(getAiSystem("search_intelligent")?.risk).toBe("low")
  })
})
