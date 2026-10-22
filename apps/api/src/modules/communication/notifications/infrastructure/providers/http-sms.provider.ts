import type { HttpSmsSettings } from "../../../communication.config"
import type { ProviderError } from "../../domain/delivery-policy"
import {
  abortedResult,
  type SendResult,
  type SmsMessage,
  type SmsProvider,
} from "./channel-provider"

export function classifySmsStatus(status: number): ProviderError {
  if (status === 429) return { kind: "QUOTA", code: "HTTP_429" }
  if (status === 408) return { kind: "TIMEOUT", code: "HTTP_408" }
  if (status >= 500) return { kind: "TEMPORARY", code: `HTTP_${status}` }
  if (status === 401 || status === 403) {
    return { kind: "CONFIG", code: `HTTP_${status}` }
  }
  if (status === 404 || status === 410) {
    return { kind: "RECIPIENT", code: `HTTP_${status}` }
  }
  if (status === 400 || status === 422) {
    return { kind: "VALIDATION", code: `HTTP_${status}` }
  }
  return { kind: "PERMANENT", code: `HTTP_${status}` }
}

/**
 * Passerelle SMS HTTP générique : `POST {to, text, sender, reference}` en
 * JSON, jeton Bearer, en-tête `Idempotency-Key`. Seul l'identifiant renvoyé
 * (`id` ou `messageId`) est conservé, jamais la réponse complète.
 */
export class HttpSmsProvider implements SmsProvider {
  readonly name = "http-sms"

  constructor(
    private readonly settings: HttpSmsSettings,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage, signal: AbortSignal): Promise<SendResult> {
    const aborted = abortedResult(signal)
    if (aborted) return aborted
    let response: Response
    try {
      response = await this.fetchImpl(this.settings.url, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "idempotency-key": message.reference,
          ...(this.settings.token
            ? { authorization: `Bearer ${this.settings.token}` }
            : {}),
        },
        body: JSON.stringify({
          to: message.to,
          text: message.text,
          sender: this.settings.senderId,
          reference: message.reference,
        }),
        redirect: "error",
      })
    } catch (error) {
      if (signal.aborted || (error as Error)?.name === "AbortError") {
        return { ok: false, error: { kind: "TIMEOUT", code: "TIMEOUT" } }
      }
      return { ok: false, error: { kind: "TEMPORARY", code: "NETWORK" } }
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      return { ok: false, error: classifySmsStatus(response.status) }
    }
    return { ok: true, externalId: await readExternalId(response) }
  }
}

async function readExternalId(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as Record<string, unknown>
    const id = payload.id ?? payload.messageId
    return typeof id === "string" || typeof id === "number"
      ? String(id).slice(0, 200)
      : null
  } catch {
    return null
  }
}
