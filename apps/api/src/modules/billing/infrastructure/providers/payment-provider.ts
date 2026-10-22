import type { ReportedPaymentStatus } from "../../domain/payment-rules"

/**
 * Contrat d'un prestataire de paiement. Le prestataire héberge la saisie des
 * moyens de paiement : aucune donnée de carte, aucun code d'authentification
 * ne transite par l'API. Seule une notification signée ou une interrogation
 * authentifiée du prestataire fait foi ; jamais une redirection du navigateur.
 */
export interface PaymentProvider {
  /** Code technique stable (`^[a-z][a-z0-9_]{1,31}$`), jamais un secret. */
  readonly code: string
  readonly environment: "TEST" | "LIVE"
  readonly capabilities: ProviderCapabilities

  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>
  /** `null` : référence inconnue du prestataire. */
  fetchStatus(providerReference: string): Promise<ProviderPaymentStatus | null>
  verifyWebhook(headers: WebhookHeaders, rawBody: Buffer): WebhookVerification
  refund?(request: RefundRequest): Promise<ProviderRefundResult>
  fetchRefundStatus?(
    providerReference: string,
  ): Promise<ProviderRefundResult | null>
}

export interface ProviderCapabilities {
  refunds: boolean
  /** Prélèvement automatique : non utilisé, les renouvellements sont manuels. */
  recurring: false
}

export interface CheckoutRequest {
  /** Référence marchande : identifiant public de la tentative. */
  reference: string
  amount: bigint
  currency: string
  description: string
  expiresAt: Date
}

export interface CheckoutResult {
  providerReference: string
  /** Page hébergée du prestataire, ou `null` (paiement sur mobile, USSD…). */
  redirectUrl: string | null
}

export interface ProviderPaymentStatus {
  providerReference: string
  reference: string
  status: ReportedPaymentStatus
  amount: bigint
  currency: string
  failureCode: string | null
}

export interface RefundRequest {
  /** Identifiant public du remboursement (idempotence côté prestataire). */
  reference: string
  paymentProviderReference: string
  amount: bigint
  currency: string
}

export interface ProviderRefundResult {
  providerReference: string
  status: "PROCESSING" | "SUCCEEDED" | "FAILED"
  failureCode: string | null
}

export type WebhookHeaders = Record<string, string | string[] | undefined>

/** Notification normalisée, seulement après vérification de la signature. */
export type VerifiedWebhookEvent =
  | ({ kind: "payment"; eventId: string } & ProviderPaymentStatus)
  | ({
      kind: "refund"
      eventId: string
      /** Identifiant public du remboursement. */
      reference: string
    } & ProviderRefundResult)

export type WebhookVerification =
  | { valid: true; event: VerifiedWebhookEvent }
  | {
      valid: false
      reason: "SIGNATURE" | "PAYLOAD"
      /** Identifiant d'événement lisible malgré l'échec, pour la trace. */
      eventId: string | null
    }
