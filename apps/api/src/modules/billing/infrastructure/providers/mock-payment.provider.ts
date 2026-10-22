import { randomUUID } from "node:crypto"
import { z } from "zod"

import type { ReportedPaymentStatus } from "../../domain/payment-rules"
import { signPayload, verifySignature } from "../../domain/webhook-signature"
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  ProviderPaymentStatus,
  ProviderRefundResult,
  RefundRequest,
  WebhookHeaders,
  WebhookVerification,
} from "./payment-provider"

export const MOCK_SIGNATURE_HEADER = "x-mock-signature"

interface MockSession {
  reference: string
  amount: bigint
  currency: string
  status: ReportedPaymentStatus
  failureCode: string | null
}

const webhookSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  type: z.enum(["payment.updated", "refund.updated"]),
  data: z.strictObject({
    reference: z.uuid(),
    provider_reference: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    status: z.enum([
      "PENDING",
      "SUCCEEDED",
      "FAILED",
      "CANCELLED",
      "EXPIRED",
      "PROCESSING",
    ]),
    amount: z.string().regex(/^\d{1,13}$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    failure_code: z.string().max(64).nullable(),
  }),
})

export type MockOutcome = "SUCCEEDED" | "FAILED" | "CANCELLED"

/**
 * Simulateur de prestataire, pour le développement et les tests uniquement :
 * refusé par la configuration en staging, en production et en environnement
 * live. Il n'encaisse rien. Ses sessions sont en mémoire (perdues au
 * redémarrage) et un résultat simulé passe par le même webhook signé que
 * celui d'un vrai prestataire : aucun raccourci ne marque une commande payée.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly code = "mock"
  readonly environment = "TEST" as const
  readonly capabilities = { refunds: true, recurring: false } as const

  private readonly sessions = new Map<string, MockSession>()
  private readonly refunds = new Map<string, ProviderRefundResult>()
  /** Réglages de test : échec d'ouverture, issue des remboursements. */
  failNextCheckout = false
  refundOutcome: ProviderRefundResult["status"] = "SUCCEEDED"

  constructor(
    private readonly secret: string,
    private readonly toleranceSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    if (this.failNextCheckout) {
      this.failNextCheckout = false
      return Promise.reject(new Error("mock: checkout indisponible"))
    }
    const providerReference = `mock_${randomUUID().replaceAll("-", "")}`
    this.sessions.set(providerReference, {
      reference: request.reference,
      amount: request.amount,
      currency: request.currency,
      status: "PENDING",
      failureCode: null,
    })
    return Promise.resolve({ providerReference, redirectUrl: null })
  }

  fetchStatus(
    providerReference: string,
  ): Promise<ProviderPaymentStatus | null> {
    const session = this.sessions.get(providerReference)
    return Promise.resolve(session ? { providerReference, ...session } : null)
  }

  refund(request: RefundRequest): Promise<ProviderRefundResult> {
    const existing = this.refunds.get(request.reference)
    if (existing) return Promise.resolve(existing)
    const result: ProviderRefundResult = {
      providerReference: `mockrf_${randomUUID().replaceAll("-", "")}`,
      status: this.refundOutcome,
      failureCode: this.refundOutcome === "FAILED" ? "MOCK_DECLINED" : null,
    }
    this.refunds.set(request.reference, result)
    return Promise.resolve(result)
  }

  fetchRefundStatus(
    providerReference: string,
  ): Promise<ProviderRefundResult | null> {
    for (const result of this.refunds.values()) {
      if (result.providerReference === providerReference) {
        return Promise.resolve(result)
      }
    }
    return Promise.resolve(null)
  }

  /** Termine un remboursement resté en cours (tests de réconciliation). */
  settleRefund(
    providerReference: string,
    status: "SUCCEEDED" | "FAILED",
  ): void {
    for (const [key, result] of this.refunds) {
      if (result.providerReference === providerReference) {
        this.refunds.set(key, {
          ...result,
          status,
          failureCode: status === "FAILED" ? "MOCK_DECLINED" : null,
        })
      }
    }
  }

  /**
   * Action du payeur sur la page du prestataire : met à jour la session puis
   * produit la notification signée que le prestataire enverrait. `amount`
   * permet de simuler une incohérence de montant.
   */
  simulate(
    providerReference: string,
    outcome: MockOutcome,
    options: { amount?: bigint; currency?: string } = {},
  ): { headers: Record<string, string>; body: string } | null {
    const session = this.sessions.get(providerReference)
    if (!session) return null
    session.status = outcome
    session.failureCode = outcome === "FAILED" ? "MOCK_DECLINED" : null
    if (options.amount !== undefined) session.amount = options.amount
    if (options.currency !== undefined) session.currency = options.currency
    return this.signedEvent({
      id: `evt_${randomUUID().replaceAll("-", "")}`,
      type: "payment.updated",
      data: {
        reference: session.reference,
        provider_reference: providerReference,
        status: session.status,
        amount: session.amount.toString(),
        currency: session.currency,
        failure_code: session.failureCode,
      },
    })
  }

  /** Notification arbitraire signée avec le secret configuré (tests). */
  signedEvent(payload: unknown, timestampSeconds?: number) {
    const body = JSON.stringify(payload)
    const t = timestampSeconds ?? Math.floor(this.now().getTime() / 1000)
    return {
      headers: {
        "content-type": "application/json",
        [MOCK_SIGNATURE_HEADER]: signPayload(this.secret, body, t),
      },
      body,
    }
  }

  verifyWebhook(headers: WebhookHeaders, rawBody: Buffer): WebhookVerification {
    const header = headers[MOCK_SIGNATURE_HEADER]
    const check = verifySignature(
      this.secret,
      rawBody,
      Array.isArray(header) ? header[0] : header,
      Math.floor(this.now().getTime() / 1000),
      this.toleranceSeconds,
    )
    if (!check.valid) {
      return { valid: false, reason: "SIGNATURE", eventId: null }
    }
    let parsed: z.infer<typeof webhookSchema>
    try {
      parsed = webhookSchema.parse(JSON.parse(rawBody.toString("utf8")))
    } catch {
      return { valid: false, reason: "PAYLOAD", eventId: null }
    }
    const { data } = parsed
    if (parsed.type === "refund.updated") {
      if (!["PROCESSING", "SUCCEEDED", "FAILED"].includes(data.status)) {
        return { valid: false, reason: "PAYLOAD", eventId: parsed.id }
      }
      return {
        valid: true,
        event: {
          kind: "refund",
          eventId: parsed.id,
          reference: data.reference,
          providerReference: data.provider_reference,
          status: data.status as ProviderRefundResult["status"],
          failureCode: data.failure_code,
        },
      }
    }
    if (data.status === "PROCESSING") {
      return { valid: false, reason: "PAYLOAD", eventId: parsed.id }
    }
    return {
      valid: true,
      event: {
        kind: "payment",
        eventId: parsed.id,
        reference: data.reference,
        providerReference: data.provider_reference,
        status: data.status,
        amount: BigInt(data.amount),
        currency: data.currency,
        failureCode: data.failure_code,
      },
    }
  }
}
