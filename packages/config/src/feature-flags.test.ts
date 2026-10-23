import { describe, expect, it } from "vitest"

import {
  FEATURE_FLAG_CATALOG,
  FEATURE_FLAG_IDS,
  isFeatureEnabled,
  publicFeatureFlags,
  resolveFeatureFlags,
} from "./feature-flags"

describe("feature-flags", () => {
  it("catalogue couvre tous les ids", () => {
    const ids = new Set(FEATURE_FLAG_CATALOG.map((flag) => flag.id))
    for (const id of FEATURE_FLAG_IDS) {
      expect(ids.has(id)).toBe(true)
    }
  })

  it("applique les valeurs par défaut sûres", () => {
    const flags = resolveFeatureFlags({})
    expect(flags.search_opensearch).toBe(false)
    expect(flags.recommendation_remote).toBe(false)
    expect(flags.metrics_scrape).toBe(false)
    expect(flags.payment_mock).toBe(false)
    expect(flags.web_assistant).toBe(true)
    expect(flags.web_recommendations).toBe(true)
    expect(flags.partners_api).toBe(true)
  })

  it("mappe SEARCH_ENGINE et RECOMMENDATION_ENGINE", () => {
    const flags = resolveFeatureFlags({
      SEARCH_ENGINE: "opensearch",
      RECOMMENDATION_ENGINE: "remote",
    })
    expect(flags.search_opensearch).toBe(true)
    expect(flags.recommendation_remote).toBe(true)
    expect(flags.recommendation_shadow).toBe(false)
  })

  it("active le shadow seulement si le remote n’est pas servi", () => {
    expect(
      resolveFeatureFlags({ RECOMMENDATION_SHADOW: "true" })
        .recommendation_shadow,
    ).toBe(true)
    expect(
      resolveFeatureFlags({
        RECOMMENDATION_ENGINE: "remote",
        RECOMMENDATION_SHADOW: "true",
      }).recommendation_shadow,
    ).toBe(false)
  })

  it("désactive les flags UI via FF_*", () => {
    expect(
      isFeatureEnabled("web_assistant", { FF_WEB_ASSISTANT: "false" }),
    ).toBe(false)
    expect(
      isFeatureEnabled("web_recommendations", {
        FF_WEB_RECOMMENDATIONS: "off",
      }),
    ).toBe(false)
  })

  it("n’expose que les flags publics", () => {
    const pub = publicFeatureFlags({
      SEARCH_ENGINE: "opensearch",
      FF_WEB_ASSISTANT: "false",
    })
    expect(pub).toEqual({
      web_assistant: false,
      web_recommendations: true,
    })
    expect(pub).not.toHaveProperty("search_opensearch")
  })

  it("swagger suit APP_ENV si SWAGGER_ENABLED absent", () => {
    expect(resolveFeatureFlags({ APP_ENV: "local" }).swagger).toBe(true)
    expect(resolveFeatureFlags({ APP_ENV: "production" }).swagger).toBe(false)
    expect(
      resolveFeatureFlags({ APP_ENV: "production", SWAGGER_ENABLED: "true" })
        .swagger,
    ).toBe(true)
  })
})
