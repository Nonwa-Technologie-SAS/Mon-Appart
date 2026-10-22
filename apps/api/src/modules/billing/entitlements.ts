// Point d'entrée sans module Nest : Listing l'utilise sans importer
// BillingModule (qui dépend d'Identity et de Communication).
import type { Db } from "../../database/database.service"
import {
  CURRENT_SUBSCRIPTION_STATUSES,
  grantsRights,
  quotaAllows,
} from "./domain/subscription-rules"

/** Statuts d'annonce comptés par le quota (en revue, publiée, en pause). */
export const QUOTA_LISTING_STATUSES = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
] as const

export interface ListingEntitlement {
  /** `null` : illimité. */
  maxActiveListings: number | null
  source: "SUBSCRIPTION" | "DEFAULT_PLAN" | "NONE"
  productCode: string | null
}

/**
 * Droit effectif d'un compte : abonnement en cours (échéance + grâce non
 * dépassée), sinon plan par défaut, sinon illimité. Les droits de
 * l'abonnement sont ceux figés au dernier paiement, pas ceux du catalogue.
 */
export async function loadListingEntitlement(
  db: Db,
  userId: bigint,
  now: Date,
  graceDays: number,
): Promise<ListingEntitlement> {
  const subscription = await db.subscription.findFirst({
    where: { userId, status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] } },
    select: {
      status: true,
      currentPeriodEnd: true,
      maxActiveListings: true,
      product: { select: { code: true } },
    },
  })
  if (subscription && grantsRights(subscription, now, graceDays)) {
    return {
      maxActiveListings: subscription.maxActiveListings,
      source: "SUBSCRIPTION",
      productCode: subscription.product.code,
    }
  }
  const plan = await db.billingProduct.findFirst({
    where: { isDefault: true },
    select: { code: true, maxActiveListings: true },
  })
  if (plan) {
    return {
      maxActiveListings: plan.maxActiveListings,
      source: "DEFAULT_PLAN",
      productCode: plan.code,
    }
  }
  return { maxActiveListings: null, source: "NONE", productCode: null }
}

export function countLiveListings(
  db: Db,
  publisherId: bigint,
): Promise<number> {
  return db.listing.count({
    where: {
      createdById: publisherId,
      deletedAt: null,
      status: { in: [...QUOTA_LISTING_STATUSES] },
    },
  })
}

/**
 * Vérifie le quota dans la transaction de mise en ligne. Le verrou
 * consultatif par publieur sérialise les mises en ligne concurrentes d'un
 * même compte : deux requêtes simultanées ne peuvent pas dépasser la limite.
 */
export async function checkListingQuota(
  db: Db,
  publisherId: bigint,
  now: Date,
  graceDays: number,
): Promise<{ allowed: boolean; limit: number | null; live: number }> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('billing:listing_quota'), ${Number(publisherId % 2_147_483_647n)}::int)`
  const entitlement = await loadListingEntitlement(
    db,
    publisherId,
    now,
    graceDays,
  )
  if (entitlement.maxActiveListings === null) {
    return { allowed: true, limit: null, live: 0 }
  }
  const live = await countLiveListings(db, publisherId)
  return {
    allowed: quotaAllows(entitlement.maxActiveListings, live),
    limit: entitlement.maxActiveListings,
    live,
  }
}
