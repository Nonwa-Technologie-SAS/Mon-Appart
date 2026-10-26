import type { TrustSignalSeverity } from "../../../generated/prisma/enums"

import { RiskRule } from "./risk-rules"

/**
 * Évaluation d'annonce pour les relecteurs. Distincte du statut de
 * vérification et de la décision de modération. Un signal isolé ne bloque rien.
 */
export const LISTING_RISK_VERSION = "listing-risk-v1"

export const LISTING_RISK_LEVELS = [
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
] as const
export type ListingRiskLevel = (typeof LISTING_RISK_LEVELS)[number]

export const LISTING_RISK_ACTIONS = [
  "MONITOR",
  "REVIEW",
  "HOLD",
  "PROTECT",
] as const
export type ListingRiskAction = (typeof LISTING_RISK_ACTIONS)[number]

const MATERIAL_FIELDS = new Set([
  "title",
  "description",
  "listingType",
  "photos",
  "location",
  "contact",
])

export type ListingRiskSignal = {
  rule: string
  severity: TrustSignalSeverity
}

export type ListingRiskInput = {
  openSignals: readonly ListingRiskSignal[]
  distinctReporters: number
  confirmedIncidents: number
}

export type ListingRiskAssessment = {
  version: typeof LISTING_RISK_VERSION
  level: ListingRiskLevel
  recommendedAction: ListingRiskAction
  humanReviewRequired: boolean
  signals: ListingRiskSignal[]
}

export function isMaterialListingChange(
  changedFields: readonly string[],
): boolean {
  return changedFields.some((field) => MATERIAL_FIELDS.has(field))
}

export function assessListingRisk(
  input: ListingRiskInput,
): ListingRiskAssessment {
  const signals = [...input.openSignals]
  const highCount = signals.filter((item) => item.severity === "HIGH").length
  const mediumCount = signals.filter(
    (item) => item.severity === "MEDIUM",
  ).length
  const reporters = Math.max(0, input.distinctReporters)
  const confirmed = Math.max(0, input.confirmedIncidents)

  let level: ListingRiskLevel = "LOW"
  if (highCount >= 2 || (highCount >= 1 && confirmed >= 1)) {
    level = "CRITICAL"
  } else if (highCount >= 1 || reporters >= 3) {
    level = "HIGH"
  } else if (mediumCount >= 1 || reporters >= 1) {
    level = "MODERATE"
  }

  const recommendedAction: ListingRiskAction =
    level === "CRITICAL"
      ? "PROTECT"
      : level === "HIGH"
        ? "HOLD"
        : level === "MODERATE"
          ? "REVIEW"
          : "MONITOR"

  return {
    version: LISTING_RISK_VERSION,
    level,
    recommendedAction,
    humanReviewRequired: recommendedAction !== "MONITOR",
    signals,
  }
}

/** Un seul signal, même HIGH, n'autorise aucune sanction automatique. */
export function isolatedSignalBlocksNothing(
  signals: readonly ListingRiskSignal[],
): boolean {
  return signals.length <= 1
}

export const LISTING_RISK_RULES: readonly RiskRule[] = [
  RiskRule.DUPLICATE_LISTING_SAME_PROPERTY,
  RiskRule.DUPLICATE_MEDIA_CROSS_ACCOUNT,
  RiskRule.MATERIAL_CHANGE_AFTER_VERIFICATION,
  RiskRule.PRICE_CHANGE_ANOMALY,
  RiskRule.ACCOUNT_BURST_ACTIVITY,
  RiskRule.REPORT_THRESHOLD,
]
