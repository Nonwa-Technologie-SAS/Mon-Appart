import type { ListingType } from "@mon-appart/types"

import type { PricePeriod } from "../../../generated/prisma/enums"

/** Budget déclaré, tel que saisi : jamais modifié par le moteur. */
export interface Budget {
  min: number | null
  max: number | null
  currency: string
  period: PricePeriod
  /** Dépassement accepté du maximum, en % (0..30). */
  tolerancePct: number
}

/** Périodicité usuelle d'un prix selon le type d'offre. */
export const DEFAULT_PRICE_PERIOD: Record<ListingType, PricePeriod> = {
  RENT: "MONTH",
  SALE: "TOTAL",
  LEASE_TO_OWN: "TOTAL",
  SHORT_TERM_RENT: "DAY",
}

/**
 * Périodicité déduite des types d'offre recherchés : `null` si elle est
 * ambiguë (location et vente mélangées) ou inconnue (aucun type).
 */
export function deducePeriod(
  listingTypes: readonly ListingType[],
): PricePeriod | null {
  const periods = new Set(
    listingTypes.map((type) => DEFAULT_PRICE_PERIOD[type]),
  )
  return periods.size === 1 ? [...periods][0]! : null
}

/** Plafond strict : le maximum, augmenté de la tolérance explicite seulement. */
export function budgetCeiling(budget: Budget): number | null {
  if (budget.max === null) return null
  return budget.max * (1 + budget.tolerancePct / 100)
}

export type BudgetFit = "WITHIN" | "WITHIN_TOLERANCE" | "BELOW_MIN"

export interface BudgetScore {
  score: number
  fit: BudgetFit
}

const COMFORT_RATIO = 0.85

/**
 * Adéquation 0..1 d'un prix au budget. `null` : prix incomparable (autre
 * devise ou périodicité) ou au-delà du plafond — l'annonce n'est pas éligible.
 *
 * - jusqu'à 85 % du maximum : 1 ;
 * - de 85 % à 100 % : de 1 à 0,7 ;
 * - dans la tolérance : de 0,7 à 0,2 ;
 * - sous le minimum : 0,6 (souvent plus petit que souhaité, pas exclu).
 */
export function scoreBudget(
  price: { amount: number; currency: string; period: PricePeriod },
  budget: Budget,
): BudgetScore | null {
  if (price.currency !== budget.currency || price.period !== budget.period) {
    return null
  }
  const ceiling = budgetCeiling(budget)
  if (ceiling !== null && price.amount > ceiling) return null
  if (budget.max !== null && price.amount > budget.max) {
    const over = (price.amount - budget.max) / (ceiling! - budget.max)
    return { score: 0.7 - 0.5 * over, fit: "WITHIN_TOLERANCE" }
  }
  if (budget.min !== null && price.amount < budget.min) {
    return { score: 0.6, fit: "BELOW_MIN" }
  }
  if (budget.max === null) return { score: 1, fit: "WITHIN" }
  const ratio = price.amount / budget.max
  if (ratio <= COMFORT_RATIO) return { score: 1, fit: "WITHIN" }
  return {
    score: 1 - ((ratio - COMFORT_RATIO) / (1 - COMFORT_RATIO)) * 0.3,
    fit: "WITHIN",
  }
}

/** Écart relatif au prix de référence : 1 si identique, 0 à ±40 % et au-delà. */
export const SIMILAR_PRICE_BAND = 0.4

export function scorePriceCloseness(amount: number, reference: number): number {
  if (reference <= 0) return 0
  return Math.max(
    0,
    1 - Math.abs(amount - reference) / (SIMILAR_PRICE_BAND * reference),
  )
}
