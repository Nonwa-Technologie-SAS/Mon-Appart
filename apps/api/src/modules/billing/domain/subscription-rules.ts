import type { SubscriptionStatus } from "../../../generated/prisma/enums"

const DAY_MS = 86_400_000

export const CURRENT_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "ACTIVE",
  "PAST_DUE",
]

/**
 * Ajoute des mois calendaires en UTC ; le jour est ramené au dernier jour du
 * mois cible (31 janvier + 1 mois = 28 ou 29 février).
 */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  )
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/**
 * Période accordée par un paiement. Un renouvellement anticipé s'ajoute à la
 * fin de la période en cours (aucun jour payé n'est perdu) ; après l'échéance,
 * la nouvelle période part du paiement (les jours de grâce ne sont pas dus).
 */
export function nextPeriod(
  currentEnd: Date | null,
  intervalMonths: number,
  now: Date,
): { start: Date; end: Date } {
  const start = currentEnd && currentEnd > now ? currentEnd : now
  return { start, end: addMonths(start, intervalMonths) }
}

export interface SubscriptionState {
  status: SubscriptionStatus
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

/** Renouvellement manuel : ouvert dans la fenêtre avant l'échéance ou en grâce. */
export function isRenewalOpen(
  subscription: SubscriptionState,
  now: Date,
  windowDays: number,
): boolean {
  if (subscription.status === "PAST_DUE") return true
  if (subscription.status !== "ACTIVE") return false
  return (
    subscription.currentPeriodEnd.getTime() - now.getTime() <=
    windowDays * DAY_MS
  )
}

/**
 * Échéances, sans prélèvement automatique : à la fin de la période, un
 * abonnement résilié se termine (CANCELLED) ; sinon il passe en grâce
 * (PAST_DUE, droits conservés), puis expire (EXPIRED).
 */
export function dueTransition(
  subscription: SubscriptionState,
  now: Date,
  graceDays: number,
): { status: SubscriptionStatus; endedAt: Date | null } | null {
  const end = subscription.currentPeriodEnd
  if (subscription.status === "ACTIVE" && end <= now) {
    if (subscription.cancelAtPeriodEnd)
      return { status: "CANCELLED", endedAt: end }
    if (graceDays === 0) return { status: "EXPIRED", endedAt: end }
    if (addDays(end, graceDays) <= now)
      return { status: "EXPIRED", endedAt: end }
    return { status: "PAST_DUE", endedAt: null }
  }
  if (subscription.status === "PAST_DUE" && addDays(end, graceDays) <= now) {
    return { status: "EXPIRED", endedAt: end }
  }
  return null
}

/** Droits effectifs : abonnement en cours, échéance + grâce non dépassée. */
export function grantsRights(
  subscription: { status: SubscriptionStatus; currentPeriodEnd: Date },
  now: Date,
  graceDays: number,
): boolean {
  return (
    CURRENT_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
    addDays(subscription.currentPeriodEnd, graceDays) > now
  )
}

/**
 * Fin d'abonnement après révocation d'une période remboursée : la période
 * retirée est soustraite. `null` : plus aucun droit, l'abonnement se termine.
 */
export function endAfterRevocation(
  subscription: { currentPeriodStart: Date; currentPeriodEnd: Date },
  period: { periodStart: Date; periodEnd: Date },
  now: Date,
): Date | null {
  const length = period.periodEnd.getTime() - period.periodStart.getTime()
  const end = new Date(subscription.currentPeriodEnd.getTime() - length)
  if (end <= now || end <= subscription.currentPeriodStart) return null
  return end
}

/** `null` : illimité. */
export function quotaAllows(limit: number | null, liveCount: number): boolean {
  return limit === null || liveCount < limit
}
