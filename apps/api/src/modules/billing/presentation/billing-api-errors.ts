import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../../identity"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, BILLING_CURSOR_INVALID, WEBHOOK_PAYLOAD_INVALID)",
  401: "Non authentifié ou signature invalide (UNAUTHENTICATED, TOKEN_EXPIRED, WEBHOOK_SIGNATURE_INVALID)",
  403: "Interdit (INSUFFICIENT_PERMISSION, REFUND_SELF_APPROVAL)",
  404: "Introuvable (PRODUCT_NOT_FOUND, PRICE_NOT_FOUND, ORDER_NOT_FOUND, PAYMENT_NOT_FOUND, SUBSCRIPTION_NOT_FOUND, REFUND_NOT_FOUND, INCIDENT_NOT_FOUND, PROVIDER_NOT_FOUND)",
  409: "Conflit d'état (ORDER_ALREADY_PENDING, ORDER_NOT_PAYABLE, ORDER_NOT_CANCELLABLE, IDEMPOTENCY_KEY_REUSED, PLAN_CHANGE_NOT_SUPPORTED, RENEWAL_NOT_OPEN, TOO_MANY_ATTEMPTS, SUBSCRIPTION_NOT_ACTIVE, REFUND_NOT_ALLOWED, REFUND_ALREADY_PENDING, REFUND_NOT_DECIDABLE, INCIDENT_ALREADY_RESOLVED, PRODUCT_CODE_EXISTS)",
  422: "Demande refusée (PRODUCT_NOT_PURCHASABLE, PRODUCT_DEFAULT_LOCKED, PRICE_INVALID, CURRENCY_NOT_SUPPORTED, REFUND_AMOUNT_EXCEEDED, REFUND_NOT_SUPPORTED)",
  429: "Trop de requêtes (TOO_MANY_REQUESTS)",
  502: "Prestataire indisponible (PROVIDER_ERROR) : aucun droit accordé",
  503: "Aucun prestataire configuré (BILLING_UNAVAILABLE)",
}

/** Réponses d'erreur Swagger du module Billing. */
export function BillingApiErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status],
        type: ErrorResponseDto,
      }),
    ),
  )
}
