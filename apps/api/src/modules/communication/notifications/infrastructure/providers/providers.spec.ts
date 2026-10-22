import type { Transporter } from "nodemailer"

import { HttpSmsProvider, classifySmsStatus } from "./http-sms.provider"
import { SmtpEmailProvider, classifySmtpError } from "./smtp-email.provider"

const settings = {
  url: "https://sms.test/send",
  token: "test-token",
  senderId: "MONAPPART",
}
const sms = {
  to: "+2250700000000",
  text: "Mon Appart : Visite confirmée",
  reference: "ref-1",
}
const live = () => new AbortController().signal

describe("classement des erreurs fournisseurs", () => {
  it("classe les statuts HTTP de la passerelle SMS", () => {
    expect(classifySmsStatus(429).kind).toBe("QUOTA")
    expect(classifySmsStatus(408).kind).toBe("TIMEOUT")
    expect(classifySmsStatus(503)).toEqual({
      kind: "TEMPORARY",
      code: "HTTP_503",
    })
    expect(classifySmsStatus(401).kind).toBe("CONFIG")
    expect(classifySmsStatus(404).kind).toBe("RECIPIENT")
    expect(classifySmsStatus(422).kind).toBe("VALIDATION")
    expect(classifySmsStatus(418).kind).toBe("PERMANENT")
  })

  it("classe les erreurs SMTP", () => {
    expect(classifySmtpError({ responseCode: 451 }).kind).toBe("TEMPORARY")
    expect(classifySmtpError({ responseCode: 550 }).kind).toBe("RECIPIENT")
    expect(classifySmtpError({ responseCode: 552 }).kind).toBe("VALIDATION")
    expect(classifySmtpError({ responseCode: 554 }).kind).toBe("PERMANENT")
    expect(classifySmtpError({ code: "EAUTH" }).kind).toBe("CONFIG")
    expect(classifySmtpError({ code: "ETIMEDOUT" }).kind).toBe("TIMEOUT")
    expect(classifySmtpError({ code: "ECONNREFUSED" }).kind).toBe("TEMPORARY")
    expect(classifySmtpError(null)).toEqual({
      kind: "TEMPORARY",
      code: "SMTP_UNKNOWN",
    })
  })
})

describe("HttpSmsProvider (fetch simulé)", () => {
  it("envoie un JSON authentifié et idempotent, ne garde que l'identifiant", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "sms-42", to: sms.to, cost: 1 }), {
          status: 200,
        }),
    )
    const provider = new HttpSmsProvider(settings, fetchImpl as typeof fetch)
    await expect(provider.send(sms, live())).resolves.toEqual({
      ok: true,
      externalId: "sms-42",
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(settings.url)
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe("Bearer test-token")
    expect(headers["idempotency-key"]).toBe("ref-1")
    expect(init.redirect).toBe("error")
    expect(JSON.parse(init.body as string)).toEqual({
      to: sms.to,
      text: sms.text,
      sender: "MONAPPART",
      reference: "ref-1",
    })
  })

  it("rapporte un refus sans prétendre à un succès", async () => {
    const provider = new HttpSmsProvider(
      settings,
      (async () => new Response("quota", { status: 429 })) as typeof fetch,
    )
    await expect(provider.send(sms, live())).resolves.toEqual({
      ok: false,
      error: { kind: "QUOTA", code: "HTTP_429" },
    })
  })

  it("distingue panne réseau et dépassement de délai", async () => {
    const network = new HttpSmsProvider(settings, (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch)
    await expect(network.send(sms, live())).resolves.toMatchObject({
      ok: false,
      error: { kind: "TEMPORARY", code: "NETWORK" },
    })

    const fetchImpl = vi.fn()
    const aborted = AbortSignal.abort()
    const provider = new HttpSmsProvider(settings, fetchImpl as typeof fetch)
    await expect(provider.send(sms, aborted)).resolves.toMatchObject({
      ok: false,
      error: { kind: "TIMEOUT" },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("accepte une réponse sans identifiant exploitable", async () => {
    const provider = new HttpSmsProvider(
      settings,
      (async () => new Response("OK", { status: 202 })) as typeof fetch,
    )
    await expect(provider.send(sms, live())).resolves.toEqual({
      ok: true,
      externalId: null,
    })
  })
})

describe("SmtpEmailProvider (transport simulé)", () => {
  const smtp = {
    host: "smtp.test",
    port: 587,
    secure: false,
    user: null,
    password: null,
    from: "Mon Appart <no-reply@mon-appart.test>",
  }
  const message = {
    to: "client@example.test",
    reference: "ref-2",
    content: { subject: "Sujet", text: "Texte", html: "<p>Texte</p>" },
  }

  it("transmet l'e-mail avec une référence stable", async () => {
    const sendMail = vi.fn(async () => ({ messageId: "<abc@smtp.test>" }))
    const provider = new SmtpEmailProvider(smtp, 1_000, {
      sendMail,
    } as unknown as Transporter)
    await expect(provider.send(message, live())).resolves.toEqual({
      ok: true,
      externalId: "<abc@smtp.test>",
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: smtp.from,
        to: message.to,
        messageId: "<ref-2@mon-appart>",
      }),
    )
  })

  it("classe un rejet du serveur", async () => {
    const provider = new SmtpEmailProvider(smtp, 1_000, {
      sendMail: async () => {
        throw Object.assign(new Error("mailbox unavailable"), {
          responseCode: 550,
        })
      },
    } as unknown as Transporter)
    await expect(provider.send(message, live())).resolves.toEqual({
      ok: false,
      error: { kind: "RECIPIENT", code: "SMTP_550" },
    })
  })

  it("abandonne à l'expiration du délai", async () => {
    const controller = new AbortController()
    const provider = new SmtpEmailProvider(smtp, 1_000, {
      sendMail: () => new Promise(() => undefined),
    } as unknown as Transporter)
    const pending = provider.send(message, controller.signal)
    controller.abort()
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { kind: "TIMEOUT" },
    })
  })
})
