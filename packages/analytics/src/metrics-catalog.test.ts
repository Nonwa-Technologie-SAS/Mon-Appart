import { describe, expect, it } from "vitest"

import { getMetric, METRICS_CATALOG } from "./metrics-catalog"

describe("metrics catalog", () => {
  it("a des identifiants uniques", () => {
    const ids = METRICS_CATALOG.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("résout kpi.contacts", () => {
    const metric = getMetric("kpi.contacts")
    expect(metric?.name).toMatch(/contact/i)
    expect(metric?.roles).toContain("analytics:admin")
  })

  it("distingue prix d’annonce et revenu plateforme", () => {
    const market = getMetric("market.price_median")
    const billing = getMetric("billing.gross_collected")
    expect(market?.limitations).toMatch(/transaction/i)
    expect(billing?.limitations).toMatch(/loyers|biens/i)
  })

  it("documente l’acquisition sans inventer de ROAS", () => {
    const acquisition = getMetric("growth.acquisition_by_channel")
    expect(acquisition?.limitations).toMatch(/causalité|dépenses/i)
  })
})
