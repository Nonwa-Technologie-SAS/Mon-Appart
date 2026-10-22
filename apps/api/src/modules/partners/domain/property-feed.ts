/**
 * Contrat d'alimentation d'annonces partenaires.
 * Les adaptateurs convertissent vers le modèle interne ; ils n'écrivent pas
 * directement en base sans passer par Listing/Property + Trust.
 */

export const LISTING_TYPE_CODES = [
  "RENT",
  "SALE",
  "SHORT_TERM_RENT",
  "LEASE_TO_OWN",
] as const

export const PRICE_PERIOD_CODES = [
  "MONTH",
  "DAY",
  "WEEK",
  "YEAR",
  "ONCE",
] as const

export type FeedListingDraft = {
  externalListingId: string
  title: string
  listingType: (typeof LISTING_TYPE_CODES)[number]
  propertyTypeCode: string
  communeCode: string
  amount: number
  currency: "XOF"
  pricePeriod: (typeof PRICE_PERIOD_CODES)[number]
  bedrooms: number | null
  surface: number | null
  description: string | null
}

export type FeedRowError = {
  line: number
  field: string
  code: string
  message: string
}

export type FeedValidationReport = {
  rowCount: number
  accepted: FeedListingDraft[]
  errors: FeedRowError[]
  duplicateExternalIds: string[]
}

export interface PropertyFeedAdapter {
  readonly kind: "CSV_IMPORT" | "API" | "FEED"
  parse(input: unknown): FeedValidationReport
}
