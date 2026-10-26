/**
 * Retour post-visite du prospect. Distinct du statut technique de la visite
 * et du stage commercial du lead. La note privée n'est jamais partagée.
 */

export const VISIT_FEEDBACK_OUTCOMES = [
  "PENDING_DECISION",
  "STILL_INTERESTED",
  "NEED_INFO",
  "WANT_ANOTHER_VISIT",
  "NOT_A_FIT",
  "UNAVAILABLE",
  "PROJECT_ABANDONED",
  "PROJECT_COMPLETED",
] as const

export type VisitFeedbackOutcome = (typeof VISIT_FEEDBACK_OUTCOMES)[number]

export const VISIT_FEEDBACK_REASONS = [
  "PRICE",
  "LOCATION",
  "SURFACE",
  "FEATURES",
  "UNAVAILABLE",
  "OTHER",
] as const

export type VisitFeedbackReason = (typeof VISIT_FEEDBACK_REASONS)[number]

export function isVisitFeedbackOutcome(
  value: string,
): value is VisitFeedbackOutcome {
  return (VISIT_FEEDBACK_OUTCOMES as readonly string[]).includes(value)
}

export function isVisitFeedbackReason(
  value: string,
): value is VisitFeedbackReason {
  return (VISIT_FEEDBACK_REASONS as readonly string[]).includes(value)
}

/** Un seul refus n'implique pas le rejet de tous les biens similaires. */
export function reasonImpliesListingUnfit(
  outcome: VisitFeedbackOutcome,
): boolean {
  return outcome === "NOT_A_FIT" || outcome === "UNAVAILABLE"
}

export function outcomeCompletesProject(
  outcome: VisitFeedbackOutcome,
): boolean {
  return outcome === "PROJECT_COMPLETED"
}

export function outcomePausesSearch(outcome: VisitFeedbackOutcome): boolean {
  return outcome === "PROJECT_ABANDONED"
}

export function ownerVisibleOutcome(input: {
  shareOutcomeWithOwner: boolean
  outcome: VisitFeedbackOutcome
}): VisitFeedbackOutcome | null {
  return input.shareOutcomeWithOwner ? input.outcome : null
}
