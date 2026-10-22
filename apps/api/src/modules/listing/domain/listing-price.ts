import type { ListingType, PricePeriod } from "../../../generated/prisma/enums"
import { listingError, ListingErrorCode } from "./listing-errors"

/** Seule devise acceptée au lancement (ISO 4217). Le libellé « FCFA » est un affichage. */
export const SUPPORTED_CURRENCIES = ["XOF"] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

/** NUMERIC(14,2) ; le XOF n'a pas de subdivision, on n'accepte que des entiers. */
export const MAX_AMOUNT = 999_999_999_999

/** Périodes cohérentes avec chaque type d'offre. */
export const ALLOWED_PERIODS: Record<ListingType, readonly PricePeriod[]> = {
  SALE: ["TOTAL"],
  RENT: ["MONTH", "YEAR"],
  SHORT_TERM_RENT: ["DAY", "WEEK", "MONTH"],
  LEASE_TO_OWN: ["MONTH"],
}

export interface PriceInput {
  amount: number
  period: PricePeriod
  currency?: string
}

export interface ValidPrice {
  amount: number
  period: PricePeriod
  currency: Currency
}

export function validatePrice(
  listingType: ListingType,
  input: PriceInput,
): ValidPrice {
  const currency = input.currency ?? "XOF"
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
    throw listingError(
      ListingErrorCode.INVALID_PRICE,
      "devise non prise en charge",
    )
  }
  if (
    !Number.isInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > MAX_AMOUNT
  ) {
    throw listingError(
      ListingErrorCode.INVALID_PRICE,
      "montant entier strictement positif attendu",
    )
  }
  if (!ALLOWED_PERIODS[listingType].includes(input.period)) {
    throw listingError(
      ListingErrorCode.INVALID_PRICE,
      `période ${input.period} incompatible avec ${listingType}`,
    )
  }
  return {
    amount: input.amount,
    period: input.period,
    currency: currency as Currency,
  }
}

/**
 * Fin de validité du prix courant : maintenant, mais toujours après son début
 * (la contrainte valid_to > valid_from tient même si deux changements tombent
 * dans la même milliseconde).
 */
export function closingInstant(validFrom: Date, now: Date): Date {
  const minimum = validFrom.getTime() + 1
  return new Date(Math.max(now.getTime(), minimum))
}
