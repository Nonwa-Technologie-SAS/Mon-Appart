import { Injectable, Logger } from "@nestjs/common"

import type { Prisma } from "../../../generated/prisma/client"
import type { PaymentEventOutcome } from "../../../generated/prisma/enums"
import { billingError } from "../domain/billing-errors"
import { amountJson } from "../domain/money"
import { sha256Hex } from "../domain/webhook-signature"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import type {
  VerifiedWebhookEvent,
  WebhookHeaders,
} from "../infrastructure/providers/payment-provider"
import { PaymentProviderRegistry } from "../infrastructure/providers/payment-provider.registry"
import { BillingActivity } from "./billing-activity"
import { PaymentService } from "./payment.service"
import { RefundService } from "./refund.service"

const MAX_BODY_BYTES = 64 * 1024

interface EventRow {
  id: bigint
  outcome: PaymentEventOutcome
  payload_sha256: string
  inserted: boolean
}

/**
 * Notifications des prestataires. Une URL difficile à deviner ne protège
 * rien : seule une signature valide (calculée sur le corps brut) ouvre le
 * traitement. Chaque événement est enregistré une fois (prestataire +
 * identifiant) ; un rejeu ne réapplique rien, un ordre d'arrivée inversé est
 * absorbé par la machine à états. La trace ne garde que l'empreinte du corps
 * et un résumé normalisé, jamais le corps brut ni un en-tête de signature.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger("Billing")

  constructor(
    private readonly repo: BillingRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
    private readonly activity: BillingActivity,
  ) {}

  async handle(
    providerCode: string,
    headers: WebhookHeaders,
    rawBody: Buffer | undefined,
  ): Promise<{ received: true }> {
    const provider = this.providers.byCode(providerCode)
    if (!provider) throw billingError("PROVIDER_NOT_FOUND")
    if (!rawBody || rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
      this.count(provider.code, "invalid_payload")
      throw billingError("WEBHOOK_PAYLOAD_INVALID")
    }
    const sha = sha256Hex(rawBody)
    const verification = provider.verifyWebhook(headers, rawBody)

    if (!verification.valid) {
      await this.record(provider.code, {
        eventId: `unverified:${sha}`,
        sha,
        signatureValid: verification.reason !== "SIGNATURE",
        outcome: "REJECTED",
        errorCode:
          verification.reason === "SIGNATURE"
            ? "INVALID_SIGNATURE"
            : "INVALID_PAYLOAD",
      })
      this.count(
        provider.code,
        verification.reason === "SIGNATURE"
          ? "invalid_signature"
          : "invalid_payload",
      )
      this.logger.warn(
        JSON.stringify({
          action: "billing.webhook_rejected",
          provider: provider.code,
          reason: verification.reason,
          payload_sha256: sha,
        }),
      )
      throw billingError(
        verification.reason === "SIGNATURE"
          ? "WEBHOOK_SIGNATURE_INVALID"
          : "WEBHOOK_PAYLOAD_INVALID",
      )
    }

    const event = verification.event
    const row = await this.record(provider.code, {
      eventId: event.eventId,
      sha,
      signatureValid: true,
      outcome: "RECEIVED",
      summary: summarize(event),
    })
    if (!row.inserted && row.outcome !== "RECEIVED") {
      this.count(provider.code, "duplicate")
      return { received: true }
    }
    if (!row.inserted && row.payload_sha256 !== sha) {
      // Même identifiant, contenu différent : jamais retraité automatiquement.
      this.count(provider.code, "id_reused")
      this.logger.warn(
        JSON.stringify({
          action: "billing.webhook_id_reused",
          provider: provider.code,
          event_id: event.eventId,
        }),
      )
      return { received: true }
    }

    const result =
      event.kind === "payment"
        ? await this.payments.applyProviderStatus(
            provider.code,
            event,
            "WEBHOOK",
          )
        : await this.applyRefund(provider.code, event)

    await this.repo.client.paymentEvent.update({
      where: { id: row.id },
      data: {
        outcome: result.outcome,
        processedAt: new Date(),
        paymentId: result.paymentId,
        errorCode:
          result.outcome === "APPLIED" ? null : result.code.slice(0, 64),
        summary: { ...summarize(event), result: result.code },
      },
    })
    this.count(provider.code, result.outcome.toLowerCase())
    return { received: true }
  }

  private async applyRefund(
    providerCode: string,
    event: Extract<VerifiedWebhookEvent, { kind: "refund" }>,
  ): Promise<{
    outcome: "APPLIED" | "IGNORED" | "REJECTED"
    code: string
    paymentId: bigint | null
  }> {
    const refund = isUuid(event.reference)
      ? await this.repo.client.paymentRefund.findUnique({
          where: { publicId: event.reference },
          select: { paymentId: true, payment: { select: { provider: true } } },
        })
      : null
    if (!refund || refund.payment.provider !== providerCode) {
      return { outcome: "REJECTED", code: "UNKNOWN_REFUND", paymentId: null }
    }
    const outcome = await this.refunds.applyResult(event.reference, event)
    return {
      outcome,
      code:
        outcome === "APPLIED"
          ? `REFUND_${event.status}`
          : "REFUND_NOT_PROCESSING",
      paymentId: refund.paymentId,
    }
  }

  /** Insère l'événement ou incrémente ses réceptions ; atomique. */
  private async record(
    provider: string,
    input: {
      eventId: string
      sha: string
      signatureValid: boolean
      outcome: PaymentEventOutcome
      errorCode?: string
      summary?: Prisma.InputJsonObject
    },
  ): Promise<EventRow> {
    const summary = JSON.stringify(input.summary ?? {})
    const rows = await this.repo.client.$queryRaw<EventRow[]>`
      INSERT INTO payment_events
        (provider, event_id, signature_valid, outcome, payload_sha256, summary, error_code)
      VALUES (
        ${provider}, ${input.eventId}, ${input.signatureValid},
        ${input.outcome}::payment_event_outcome, ${input.sha},
        ${summary}::jsonb, ${input.errorCode ?? null}
      )
      ON CONFLICT (provider, event_id)
        DO UPDATE SET attempts = payment_events.attempts + 1
      RETURNING id, outcome, payload_sha256, (xmax = 0) AS inserted`
    return rows[0]!
  }

  private count(provider: string, outcome: string): void {
    this.activity.metrics.billing.webhooks.inc({ provider, outcome })
  }
}

function summarize(event: VerifiedWebhookEvent): Prisma.InputJsonObject {
  return event.kind === "payment"
    ? {
        kind: "payment",
        status: event.status,
        amount: amountJson(event.amount),
        currency: event.currency,
      }
    : { kind: "refund", status: event.status }
}
