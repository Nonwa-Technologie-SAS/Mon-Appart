/**
 * Montants en unités mineures entières (`bigint`), jamais en flottant. Le
 * franc CFA (XOF) n'a pas de subdivision : 1 unité = 1 franc. Aucun arrondi,
 * aucun prorata : un montant facturé est toujours un tarif du catalogue.
 */
export const SUPPORTED_CURRENCIES = ["XOF"] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

/** Aligné sur les contraintes CHECK des tables de facturation. */
export const MAX_AMOUNT = 1_000_000_000_000n

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/** Montant strictement positif et borné ; `null` si invalide. */
export function parseAmount(value: unknown): bigint | null {
  let amount: bigint
  if (typeof value === "bigint") amount = value
  else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return null
    amount = BigInt(value)
  } else if (typeof value === "string" && /^\d{1,13}$/.test(value)) {
    amount = BigInt(value)
  } else return null
  return amount > 0n && amount <= MAX_AMOUNT ? amount : null
}

/** Représentation JSON : chaîne décimale, sans perte au-delà de 2^53. */
export function amountJson(amount: bigint): string {
  return amount.toString()
}

export function sameMoney(
  a: { amount: bigint; currency: string },
  b: { amount: bigint; currency: string },
): boolean {
  return a.amount === b.amount && a.currency === b.currency
}
