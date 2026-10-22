import type {
  BillingOrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/enums"

/** Statut normalisé rapporté par un prestataire (webhook ou interrogation). */
export type ReportedPaymentStatus = Exclude<PaymentStatus, "CREATED">

export const OPEN_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "CREATED",
  "PENDING",
]

const FAILURE_STATUSES: readonly PaymentStatus[] = [
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]

export type PaymentDecision =
  /** Même statut : rien à écrire (notification rejouée). */
  | { action: "noop" }
  /** Statut final déjà atteint : la notification n'est pas appliquée. */
  | { action: "ignore"; reason: "TERMINAL" | "REGRESSION" }
  | { action: "apply"; next: ReportedPaymentStatus; lateSuccess: boolean }

/**
 * Machine à états d'une tentative de paiement, appliquée côté serveur
 * uniquement. Un statut final ne régresse jamais ; seule exception : un
 * succès confirmé par le prestataire après un échec, une annulation ou une
 * expiration locale (paiement tardif). Il est appliqué, car l'argent a été
 * encaissé, et signalé par un incident.
 */
export function decidePayment(
  current: PaymentStatus,
  reported: ReportedPaymentStatus,
): PaymentDecision {
  if (current === reported) return { action: "noop" }
  if (OPEN_PAYMENT_STATUSES.includes(current)) {
    if (current === "PENDING" && reported === "PENDING")
      return { action: "noop" }
    return { action: "apply", next: reported, lateSuccess: false }
  }
  if (current === "SUCCEEDED") return { action: "ignore", reason: "REGRESSION" }
  if (FAILURE_STATUSES.includes(current) && reported === "SUCCEEDED") {
    return { action: "apply", next: "SUCCEEDED", lateSuccess: true }
  }
  return { action: "ignore", reason: "TERMINAL" }
}

/**
 * Effet d'un paiement réussi sur sa commande. Une commande annulée ou expirée
 * dont le paiement aboutit tout de même devient payée (le client a payé ce
 * contenu figé) ; une commande déjà payée n'est jamais servie deux fois.
 */
export function orderOnPaymentSuccess(
  status: BillingOrderStatus,
): "MARK_PAID" | "DUPLICATE" {
  return status === "PAID" || status === "REFUNDED" ? "DUPLICATE" : "MARK_PAID"
}

export function isOrderPayable(
  order: { status: BillingOrderStatus; expiresAt: Date },
  now: Date,
): boolean {
  return order.status === "PENDING" && order.expiresAt > now
}

export function isOrderCancellable(status: BillingOrderStatus): boolean {
  return status === "PENDING"
}

/** Code d'échec prestataire réduit à un format sûr pour la base et les logs. */
export function safeFailureCode(value: unknown): string | null {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : "UNKNOWN"
}
