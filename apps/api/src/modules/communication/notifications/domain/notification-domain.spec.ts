import { parseFallbacks } from "../../communication.config"
import {
  decide,
  errorLabel,
  isRetryable,
  retryDelayMs,
} from "./delivery-policy"
import {
  categoryOf,
  hasDestination,
  isEnabled,
  isLocked,
  planChannels,
  preferenceKey,
  type ExternalChannel,
} from "./notification-policy"
import { escapeHtml, renderEmail, renderPush, renderSms } from "./templates"

const contact = {
  emailVerified: true,
  phoneVerified: true,
  activePushDevices: 1,
}
const all = new Set<ExternalChannel>(["EMAIL", "SMS", "PUSH", "WHATSAPP"])

describe("préférences de notification", () => {
  it("verrouille l'in-app (hors marketing) et l'e-mail de compte", () => {
    expect(isLocked("MESSAGES", "IN_APP")).toBe(true)
    expect(isLocked("MARKETING", "IN_APP")).toBe(false)
    expect(isLocked("ACCOUNT", "EMAIL")).toBe(true)
    expect(isLocked("MESSAGES", "EMAIL")).toBe(false)
  })

  it("applique verrou, puis choix enregistré, puis défaut", () => {
    const stored = new Map([
      [preferenceKey("ACCOUNT", "EMAIL"), false],
      [preferenceKey("MESSAGES", "EMAIL"), false],
    ])
    expect(isEnabled("ACCOUNT", "EMAIL", stored)).toBe(true)
    expect(isEnabled("MESSAGES", "EMAIL", stored)).toBe(false)
    expect(isEnabled("MESSAGES", "PUSH", stored)).toBe(true)
    expect(isEnabled("MESSAGES", "SMS", stored)).toBe(false)
    expect(isEnabled("MARKETING", "EMAIL", new Map())).toBe(false)
  })

  it("déduit la catégorie du type", () => {
    expect(categoryOf("MESSAGE")).toBe("MESSAGES")
    expect(categoryOf("APPOINTMENT")).toBe("VISITS")
    expect(categoryOf("SYSTEM")).toBe("ACCOUNT")
  })

  it("n'envoie jamais vers un contact non vérifié", () => {
    const none = {
      emailVerified: false,
      phoneVerified: false,
      activePushDevices: 0,
    }
    expect(hasDestination("EMAIL", none)).toBe(false)
    expect(hasDestination("SMS", none)).toBe(false)
    expect(hasDestination("WHATSAPP", none)).toBe(false)
    expect(hasDestination("PUSH", none)).toBe(false)
    expect(hasDestination("PUSH", contact)).toBe(true)
  })

  it("planifie seulement les canaux disponibles, activés et joignables", () => {
    const stored = new Map<string, boolean>()
    expect(
      planChannels({ category: "VISITS", stored, available: all, contact }),
    ).toEqual(["EMAIL", "SMS", "PUSH"])
    expect(
      planChannels({
        category: "VISITS",
        stored,
        available: new Set<ExternalChannel>(["EMAIL"]),
        contact: { ...contact, emailVerified: false },
      }),
    ).toEqual([])
    expect(
      planChannels({ category: "MESSAGES", stored, available: all, contact }),
    ).not.toContain("SMS")
  })
})

describe("politique de livraison", () => {
  it("ne retente que les erreurs passagères", () => {
    expect(isRetryable("TEMPORARY")).toBe(true)
    expect(isRetryable("QUOTA")).toBe(true)
    expect(isRetryable("TIMEOUT")).toBe(true)
    expect(isRetryable("RECIPIENT")).toBe(false)
    expect(isRetryable("CONFIG")).toBe(false)
  })

  it("calcule un délai exponentiel plafonné avec aléa borné", () => {
    expect(retryDelayMs(1, 30, () => 0.5)).toBe(30_000)
    expect(retryDelayMs(3, 30, () => 0.5)).toBe(120_000)
    expect(retryDelayMs(30, 30, () => 0.5)).toBe(6 * 3_600_000)
    expect(retryDelayMs(1, 30, () => 0)).toBe(24_000)
    expect(retryDelayMs(1, 30, () => 1)).toBe(36_000)
  })

  it("décide SENT, RETRY ou FAILED avec ou sans repli", () => {
    const base = {
      attempt: 1,
      maxAttempts: 3,
      baseSeconds: 10,
      random: () => 0.5,
    }
    expect(decide({ ...base, error: null })).toEqual({ status: "SENT" })
    expect(
      decide({ ...base, error: { kind: "TEMPORARY", code: "HTTP_503" } }),
    ).toEqual({ status: "RETRY", delayMs: 10_000 })
    expect(
      decide({
        ...base,
        attempt: 3,
        error: { kind: "TEMPORARY", code: "HTTP_503" },
      }),
    ).toEqual({ status: "FAILED", fallback: true })
    expect(
      decide({ ...base, error: { kind: "RECIPIENT", code: "SMTP_550" } }),
    ).toEqual({ status: "FAILED", fallback: true })
    expect(
      decide({ ...base, error: { kind: "CONFIG", code: "HTTP_401" } }),
    ).toEqual({ status: "FAILED", fallback: false })
  })

  it("réduit l'erreur à un code court", () => {
    expect(errorLabel({ kind: "QUOTA", code: "HTTP_429" })).toBe(
      "QUOTA:HTTP_429",
    )
    expect(
      errorLabel({ kind: "PERMANENT", code: "x".repeat(200) }),
    ).toHaveLength(100)
  })

  it("n'accepte que des replis entre canaux externes connus, un par source", () => {
    const fallbacks = parseFallbacks(
      "push>email, sms>IN_APP, EMAIL>FOO, SMS>SMS, PUSH>SMS, WHATSAPP>SMS",
    )
    expect([...fallbacks]).toEqual([
      ["PUSH", "EMAIL"],
      ["WHATSAPP", "SMS"],
    ])
    expect(parseFallbacks(undefined).size).toBe(0)
  })

  it("refuse chaînes et cycles de repli", () => {
    expect([...parseFallbacks("EMAIL>SMS,SMS>PUSH")]).toEqual([
      ["EMAIL", "SMS"],
    ])
    expect([...parseFallbacks("EMAIL>SMS,PUSH>EMAIL")]).toEqual([
      ["EMAIL", "SMS"],
    ])
    expect([...parseFallbacks("EMAIL>PUSH,PUSH>EMAIL")]).toEqual([
      ["EMAIL", "PUSH"],
    ])
  })

  it("diffère un canal de repli tant que son canal principal est planifié", () => {
    const stored = new Map<string, boolean>()
    const fallbacks = parseFallbacks("EMAIL>SMS")
    expect(
      planChannels({
        category: "VISITS",
        stored,
        available: all,
        contact,
        fallbacks,
      }),
    ).toEqual(["EMAIL", "PUSH"])
    expect(
      planChannels({
        category: "VISITS",
        stored,
        available: all,
        contact: { ...contact, emailVerified: false },
        fallbacks,
      }),
    ).toEqual(["SMS", "PUSH"])
    const cyclic = new Map([
      ["EMAIL", "PUSH"],
      ["PUSH", "EMAIL"],
    ] as const)
    expect(
      planChannels({
        category: "MESSAGES",
        stored,
        available: all,
        contact,
        fallbacks: cyclic,
      }),
    ).toEqual(["EMAIL", "PUSH"])
  })
})

describe("gabarits", () => {
  const input = {
    category: "MESSAGES" as const,
    title: "Nouveau message",
    body: 'À propos de « <script>alert("x")</script> »',
    link: "https://app.test/messages?a=1&b=2",
  }

  it("échappe le HTML de l'e-mail", () => {
    const email = renderEmail(input)
    expect(email.subject).toBe("Mon Appart — Nouveau message")
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;script&gt;")
    expect(email.html).toContain("a=1&amp;b=2")
    expect(email.text).toContain(input.body)
    expect(escapeHtml(`<a href="x">'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;",
    )
  })

  it("garde le SMS court, sans le corps", () => {
    const sms = renderSms(input)
    expect(sms).toBe(
      "Mon Appart : Nouveau message https://app.test/messages?a=1&b=2",
    )
    expect(sms).not.toContain("script")
    const long = renderSms({ ...input, title: "x".repeat(300), link: null })
    expect(long.length).toBeLessThanOrEqual(160)
    const dropLink = renderSms({
      ...input,
      link: `https://a.test/${"y".repeat(200)}`,
    })
    expect(dropLink).toBe("Mon Appart : Nouveau message")
  })

  it("n'affiche que la marque et l'intitulé en push (écran verrouillé)", () => {
    expect(renderPush(input)).toEqual({
      title: "Mon Appart",
      body: "Nouveau message",
    })
  })
})
