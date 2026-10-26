/**
 * Segmentation du cycle de vie immobilier. Les états sont dérivés
 * d'événements observables et de déclarations explicites — jamais d'une
 * simple baisse de fréquentation.
 */

export const LIFECYCLE_SEGMENTS = [
  "ACTIVE_SEARCH",
  "EXPLORATORY",
  "VISIT_PHASE",
  "WAITING",
  "PROJECT_COMPLETED",
  "PUBLISHER",
] as const

export type LifecycleSegment = (typeof LIFECYCLE_SEGMENTS)[number]

export const REACTIVATION_SCENARIOS = [
  "NEW_OPPORTUNITIES",
  "RESUME_SEARCH",
  "UNAVAILABLE_ALTERNATIVE",
  "UNANSWERED_REQUEST",
  "POST_VISIT",
  "PUBLISHER_IDLE",
] as const

export type ReactivationScenario = (typeof REACTIVATION_SCENARIOS)[number]

export type LifecycleInput = {
  projectStatus: "ACTIVE" | "PAUSED" | "COMPLETED"
  isPublisher: boolean
  hasUpcomingVisit: boolean
  hasCompletedVisitWithoutFeedback: boolean
  savedSearchCount: number
  favoriteCount: number
  recentSearchCount: number
  lastLoginAt: Date | null
  now: Date
}

export type ReactivationInput = {
  projectStatus: "ACTIVE" | "PAUSED" | "COMPLETED"
  lastLoginAt: Date | null
  lastReactivationAt: Date | null
  alertsEnabled: boolean
  hasExactMatches: boolean
  idleDays: number
  cooldownDays: number
  now: Date
}

const DAY_MS = 86_400_000

export function classifyLifecycle(input: LifecycleInput): LifecycleSegment {
  if (input.projectStatus === "COMPLETED") return "PROJECT_COMPLETED"
  if (input.isPublisher) return "PUBLISHER"
  if (input.hasUpcomingVisit) return "VISIT_PHASE"
  if (input.savedSearchCount > 0 || input.favoriteCount > 0) {
    return "ACTIVE_SEARCH"
  }
  if (input.recentSearchCount > 0) return "EXPLORATORY"
  if (input.hasCompletedVisitWithoutFeedback) return "WAITING"
  if (input.projectStatus === "PAUSED") return "WAITING"
  return "EXPLORATORY"
}

export function daysSince(from: Date | null, now: Date): number | null {
  if (!from) return null
  return Math.floor((now.getTime() - from.getTime()) / DAY_MS)
}

/**
 * Une inactivité n'est jamais une fin de projet. La réactivation exige des
 * annonces réellement pertinentes et le respect du cooldown.
 */
export function isReactivationEligible(input: ReactivationInput): {
  eligible: boolean
  scenario: ReactivationScenario | null
} {
  if (input.projectStatus === "COMPLETED" || input.projectStatus === "PAUSED") {
    return { eligible: false, scenario: null }
  }
  if (!input.alertsEnabled || !input.hasExactMatches) {
    return { eligible: false, scenario: null }
  }
  const idle = daysSince(input.lastLoginAt, input.now)
  if (idle === null || idle < input.idleDays) {
    return { eligible: false, scenario: null }
  }
  const sinceReactivation = daysSince(input.lastReactivationAt, input.now)
  if (sinceReactivation !== null && sinceReactivation < input.cooldownDays) {
    return { eligible: false, scenario: null }
  }
  return { eligible: true, scenario: "NEW_OPPORTUNITIES" }
}

export function utcDayKey(at: Date): string {
  return at.toISOString().slice(0, 10)
}

export function utcWeekKey(at: Date): string {
  const date = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  )
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
  )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}
