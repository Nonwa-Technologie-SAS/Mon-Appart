import { createTransport, type Transporter } from "nodemailer"

import type { SmtpSettings } from "../../../communication.config"
import type { ProviderError } from "../../domain/delivery-policy"
import {
  abortedResult,
  type EmailMessage,
  type EmailProvider,
  type SendResult,
} from "./channel-provider"

interface SmtpLikeError {
  code?: string
  responseCode?: number
}

/**
 * Classement d'une erreur nodemailer. 4xx : refus passager (greylisting,
 * boîte pleine) ; 550/551/553 : destinataire inconnu ; autres 5xx : refus
 * définitif ; EAUTH : identifiants invalides (configuration).
 */
export function classifySmtpError(error: unknown): ProviderError {
  const { code, responseCode } = (error ?? {}) as SmtpLikeError
  if (typeof responseCode === "number") {
    if (responseCode >= 400 && responseCode < 500) {
      return { kind: "TEMPORARY", code: `SMTP_${responseCode}` }
    }
    if ([550, 551, 553].includes(responseCode)) {
      return { kind: "RECIPIENT", code: `SMTP_${responseCode}` }
    }
    if (responseCode === 552) {
      return { kind: "VALIDATION", code: "SMTP_552" }
    }
    if (responseCode >= 500) {
      return { kind: "PERMANENT", code: `SMTP_${responseCode}` }
    }
  }
  switch (code) {
    case "EAUTH":
    case "ENOAUTH":
    case "EENVELOPE":
      return { kind: "CONFIG", code: `SMTP_${code}` }
    case "ETIMEDOUT":
      return { kind: "TIMEOUT", code: "SMTP_ETIMEDOUT" }
    case "ECONNECTION":
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "ESOCKET":
    case "EDNS":
    case "ETLS":
      return { kind: "TEMPORARY", code: `SMTP_${code}` }
    default:
      return { kind: "TEMPORARY", code: "SMTP_UNKNOWN" }
  }
}

/** E-mail transactionnel par SMTP (STARTTLS exigé hors TLS implicite). */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp"
  private readonly transport: Transporter

  constructor(
    private readonly settings: SmtpSettings,
    timeoutMs: number,
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        requireTLS: !settings.secure,
        auth: settings.user
          ? { user: settings.user, pass: settings.password ?? "" }
          : undefined,
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs,
        disableFileAccess: true,
        disableUrlAccess: true,
      })
  }

  async send(message: EmailMessage, signal: AbortSignal): Promise<SendResult> {
    const aborted = abortedResult(signal)
    if (aborted) return aborted
    try {
      const info = (await Promise.race([
        this.transport.sendMail({
          from: this.settings.from,
          to: message.to,
          subject: message.content.subject,
          text: message.content.text,
          html: message.content.html,
          messageId: `<${message.reference}@mon-appart>`,
          headers: { "X-Mon-Appart-Reference": message.reference },
        }),
        new Promise<never>((_, reject) => {
          signal.addEventListener(
            "abort",
            () =>
              reject(
                Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }),
              ),
            { once: true },
          )
        }),
      ])) as { messageId?: string }
      return { ok: true, externalId: info.messageId?.slice(0, 200) ?? null }
    } catch (error) {
      return { ok: false, error: classifySmtpError(error) }
    }
  }
}
