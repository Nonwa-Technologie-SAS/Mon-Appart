import { describe, expect, it } from "vitest"

import { scanMessageSafety, trustRuleForHint } from "./message-safety"

describe("message-safety", () => {
  it("détecte une demande d'OTP sans bloquer l'envoi", () => {
    const hints = scanMessageSafety("Envoie-moi le code OTP pour valider")
    expect(hints.map((item) => item.code)).toContain("CREDENTIAL_HARVEST")
    expect(trustRuleForHint("CREDENTIAL_HARVEST")).toBe(
      "MESSAGE_CREDENTIAL_HARVEST",
    )
  })

  it("ne classe pas un lien court isolé comme preuve de phishing", () => {
    const hints = scanMessageSafety("Voici le plan : https://bit.ly/abc123")
    const link = hints.find((item) => item.code === "PHISHING_LINK")
    expect(link?.severity).toBe("MEDIUM")
  })

  it("ne signale pas un message de visite ordinaire", () => {
    expect(
      scanMessageSafety("On peut visiter mardi à 10 h à Cocody ?"),
    ).toEqual([])
  })

  it("avertit un déplacement WhatsApp sans l'interdire", () => {
    const hints = scanMessageSafety("Passe sur WhatsApp pour continuer")
    expect(hints[0]?.code).toBe("OFF_PLATFORM")
    expect(hints[0]?.severity).toBe("LOW")
  })

  it("détecte un faux support sans bloquer le message", () => {
    const hints = scanMessageSafety(
      "Le support officiel de Mon Appart exige votre mot de passe",
    )
    expect(hints.map((item) => item.code)).toEqual(
      expect.arrayContaining(["FAKE_SUPPORT", "CREDENTIAL_HARVEST"]),
    )
  })
})
