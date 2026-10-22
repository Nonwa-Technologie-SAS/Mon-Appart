export const BILLING_TABS = [
  { key: "summary", label: "Synthèse" },
  { key: "orders", label: "Commandes" },
  { key: "payments", label: "Paiements" },
  { key: "subscriptions", label: "Abonnements" },
  { key: "refunds", label: "Remboursements" },
  { key: "incidents", label: "Incidents" },
  { key: "webhooks", label: "Notifications" },
  { key: "catalog", label: "Catalogue" },
] as const

export type BillingTab = (typeof BILLING_TABS)[number]["key"]

export function billingTab(value: string | undefined): BillingTab {
  return BILLING_TABS.find((tab) => tab.key === value)?.key ?? "summary"
}

const ZERO = BigInt(0)

/** Montant restant remboursable, en entier exact (jamais de flottant). */
export function refundableAmount(payment: {
  status: string
  amount: string
  refundedAmount: string
}): bigint {
  if (payment.status !== "SUCCEEDED") return ZERO
  const left = BigInt(payment.amount) - BigInt(payment.refundedAmount)
  return left > ZERO ? left : ZERO
}

/** Champ vide = illimité ; sinon entier positif ou nul ; `undefined` si invalide. */
export function parseQuota(raw: string): number | null | undefined {
  const value = raw.trim()
  if (value === "") return null
  return /^\d{1,6}$/.test(value) ? Number(value) : undefined
}
