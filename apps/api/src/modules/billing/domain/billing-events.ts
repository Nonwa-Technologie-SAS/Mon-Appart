/**
 * Événements de domaine, publiés après validation de la transaction. Les
 * succès (paiement, abonnement, remboursement) ne sont émis que depuis un
 * état confirmé en base, jamais depuis une redirection du navigateur.
 */
export const BillingEvent = {
  CHECKOUT_STARTED: "billing.checkout_started",
  PAYMENT_ATTEMPT_CREATED: "billing.payment_attempt_created",
  PAYMENT_SUCCEEDED: "billing.payment_succeeded",
  PAYMENT_FAILED: "billing.payment_failed",
  SUBSCRIPTION_STARTED: "billing.subscription_started",
  SUBSCRIPTION_RENEWED: "billing.subscription_renewed",
  SUBSCRIPTION_CANCELLED: "billing.subscription_cancelled",
  REFUND_REQUESTED: "billing.refund_requested",
  REFUND_COMPLETED: "billing.refund_completed",
} as const

export const BillingAuditAction = {
  PRODUCT_CREATED: "BILLING_PRODUCT_CREATED",
  PRODUCT_UPDATED: "BILLING_PRODUCT_UPDATED",
  PRICE_CREATED: "BILLING_PRICE_CREATED",
  PRICE_ARCHIVED: "BILLING_PRICE_ARCHIVED",
  ORDER_CREATED: "BILLING_ORDER_CREATED",
  ORDER_CANCELLED: "BILLING_ORDER_CANCELLED",
  ORDER_EXPIRED: "BILLING_ORDER_EXPIRED",
  PAYMENT_STARTED: "PAYMENT_STARTED",
  PAYMENT_STATUS_CHANGED: "PAYMENT_STATUS_CHANGED",
  PAYMENT_CHECK_REQUESTED: "PAYMENT_CHECK_REQUESTED",
  ORDER_FULFILLED: "BILLING_ORDER_FULFILLED",
  SUBSCRIPTION_CANCEL_REQUESTED: "SUBSCRIPTION_CANCEL_REQUESTED",
  SUBSCRIPTION_STATUS_CHANGED: "SUBSCRIPTION_STATUS_CHANGED",
  SUBSCRIPTION_PERIOD_REVOKED: "SUBSCRIPTION_PERIOD_REVOKED",
  REFUND_REQUESTED: "REFUND_REQUESTED",
  REFUND_APPROVED: "REFUND_APPROVED",
  REFUND_REJECTED: "REFUND_REJECTED",
  REFUND_STATUS_CHANGED: "REFUND_STATUS_CHANGED",
  INCIDENT_OPENED: "BILLING_INCIDENT_OPENED",
  INCIDENT_RESOLVED: "BILLING_INCIDENT_RESOLVED",
} as const

export const BillingEntity = {
  PRODUCT: "billing_product",
  PRICE: "billing_price",
  ORDER: "billing_order",
  PAYMENT: "payment_transaction",
  REFUND: "payment_refund",
  SUBSCRIPTION: "subscription",
  INCIDENT: "billing_incident",
} as const
