import type {
  ListingStatus,
  PropertyStatus,
} from "../../../generated/prisma/enums"
import { listingError, ListingErrorCode } from "./listing-errors"

const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_DURATION_DAYS = 365
/** Une échéance trop proche serait expirée avant d'être vue. */
const MIN_DURATION_MS = 60 * 60 * 1000

export interface PublicationCheck {
  listingTitle: string
  hasCurrentPrice: boolean
  propertyStatus: PropertyStatus
  propertyDeleted: boolean
  /** Champs manquants du bien (règle de complétude du module Property). */
  propertyMissing: readonly string[]
}

/** Conditions de publication ; l'erreur la plus actionnable d'abord. */
export function assertPublishable(check: PublicationCheck): void {
  if (check.propertyDeleted || check.propertyStatus !== "ACTIVE") {
    throw listingError(ListingErrorCode.PROPERTY_NOT_ACTIVE)
  }
  if (check.propertyMissing.length > 0) {
    throw listingError(
      ListingErrorCode.LISTING_INCOMPLETE,
      `bien : ${check.propertyMissing.join(", ")}`,
    )
  }
  if (check.listingTitle.trim().length === 0) {
    throw listingError(ListingErrorCode.LISTING_INCOMPLETE, "title")
  }
  if (!check.hasCurrentPrice)
    throw listingError(ListingErrorCode.NO_ACTIVE_PRICE)
}

/** Une date d'expiration demandée doit tomber entre +1 h et +365 j. */
export function assertValidExpiry(expiresAt: Date, now: Date): void {
  const delta = expiresAt.getTime() - now.getTime()
  if (delta < MIN_DURATION_MS || delta > MAX_DURATION_DAYS * DAY_MS) {
    throw listingError(
      ListingErrorCode.INVALID_EXPIRY,
      "entre 1 heure et 365 jours",
    )
  }
}

/** Échéance à la (re)publication : demandée, sinon conservée si future, sinon durée par défaut. */
export function computeExpiry(input: {
  now: Date
  requested?: Date
  current: Date | null
  defaultDays: number
}): Date {
  if (input.requested) {
    assertValidExpiry(input.requested, input.now)
    return input.requested
  }
  if (
    input.current &&
    input.current.getTime() - input.now.getTime() >= MIN_DURATION_MS
  ) {
    return input.current
  }
  return new Date(input.now.getTime() + input.defaultDays * DAY_MS)
}

/** Une nouvelle date de publication est posée sauf à la reprise d'une annonce déjà vue. */
export function needsNewPublicationDate(
  from: ListingStatus,
  publishedAt: Date | null,
): boolean {
  return (
    publishedAt === null ||
    ["DRAFT", "PENDING_REVIEW", "EXPIRED"].includes(from)
  )
}
