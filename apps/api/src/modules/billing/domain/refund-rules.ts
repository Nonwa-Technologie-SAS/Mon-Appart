import type {
  PaymentStatus,
  RefundStatus,
} from "../../../generated/prisma/enums"

/** Demandes qui réservent encore une part du montant remboursable. */
export const OPEN_REFUND_STATUSES: readonly RefundStatus[] = [
  "REQUESTED",
  "PROCESSING",
]

/**
 * Montant encore remboursable : encaissé, moins les remboursements confirmés
 * et ceux en cours. Ne descend jamais sous zéro.
 */
export function refundableAmount(
  payment: { status: PaymentStatus; amount: bigint; refundedAmount: bigint },
  openRefunds: readonly { amount: bigint }[],
): bigint {
  if (payment.status !== "SUCCEEDED") return 0n
  const reserved = openRefunds.reduce((sum, refund) => sum + refund.amount, 0n)
  const left = payment.amount - payment.refundedAmount - reserved
  return left > 0n ? left : 0n
}

/** Remboursement intégral : retire le droit accordé par la commande. */
export function isFullRefund(payment: {
  amount: bigint
  refundedAmount: bigint
}): boolean {
  return payment.refundedAmount >= payment.amount
}
