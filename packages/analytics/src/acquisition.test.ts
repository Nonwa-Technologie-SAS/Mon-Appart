import { describe, expect, it } from "vitest"

import {
  buildAcquisitionTouch,
  classifyAcquisitionChannel,
  hasAttributionSignal,
  normalizeCampaignCode,
  referrerHostFromUrl,
} from "./acquisition"
import { validateEvent } from "./validation"

describe("acquisition", () => {
  it("normalise les UTM en codes stables", () => {
    expect(normalizeCampaignCode("google-ads")).toBe("GOOGLE_ADS")
    expect(normalizeCampaignCode("  Abidjan Launch! ")).toBe("ABIDJAN_LAUNCH")
    expect(normalizeCampaignCode("")).toBeNull()
    expect(normalizeCampaignCode(null)).toBeNull()
  })

  it("extrait le host referrer sans chemin", () => {
    expect(referrerHostFromUrl("https://www.google.com/search?q=appart")).toBe(
      "WWW_GOOGLE_COM",
    )
    expect(referrerHostFromUrl("not-a-url")).toBeNull()
    expect(referrerHostFromUrl("http://localhost:3000/")).toBeNull()
  })

  it("classe les canaux sans inventer de dépenses", () => {
    expect(
      classifyAcquisitionChannel({
        utmSource: "GOOGLE",
        utmMedium: "CPC",
        referrerHost: null,
      }),
    ).toBe("PAID")
    expect(
      classifyAcquisitionChannel({
        utmSource: "GOOGLE",
        utmMedium: "ORGANIC",
        referrerHost: null,
      }),
    ).toBe("ORGANIC_SEARCH")
    expect(
      classifyAcquisitionChannel({
        utmSource: null,
        utmMedium: null,
        referrerHost: null,
      }),
    ).toBe("DIRECT")
  })

  it("construit un touch compatible catalogue", () => {
    const touch = buildAcquisitionTouch({
      searchParams: {
        utm_source: "facebook",
        utm_medium: "social",
        utm_campaign: "lancement-abidjan",
      },
      referrer: "https://m.facebook.com/",
      landingRoute: "/appartements-a-louer",
      touchKind: "FIRST",
    })
    expect(touch.channel).toBe("SOCIAL")
    expect(touch.utmSource).toBe("FACEBOOK")
    expect(touch.utmCampaign).toBe("LANCEMENT_ABIDJAN")
    expect(hasAttributionSignal(touch)).toBe(true)

    const result = validateEvent("acquisition_touch", 1, touch, "client")
    expect(result.ok).toBe(true)
  })
})
