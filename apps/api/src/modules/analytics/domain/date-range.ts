import { analyticsError } from "./analytics-errors"
import { addDays, isoDay, utcDay } from "./ingestion-rules"

export interface DateRange {
  from: Date
  to: Date
  days: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function parseDay(value: string, name: string): Date {
  const date = DAY.test(value) ? new Date(`${value}T00:00:00.000Z`) : null
  if (!date || Number.isNaN(date.getTime()) || isoDay(date) !== value) {
    throw analyticsError("ANALYTICS_RANGE_INVALID", `${name} : AAAA-MM-JJ`)
  }
  return date
}

/** Période inclusive en jours UTC ; défaut : les `defaultDays` derniers jours. */
export function parseDateRange(
  input: { from?: string; to?: string },
  limits: { defaultDays: number; maxDays: number },
  now = new Date(),
): DateRange {
  const to = input.to ? parseDay(input.to, "to") : utcDay(now)
  const from = input.from
    ? parseDay(input.from, "from")
    : addDays(to, 1 - limits.defaultDays)
  if (from > to) {
    throw analyticsError("ANALYTICS_RANGE_INVALID", "from postérieur à to")
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  if (days > limits.maxDays) {
    throw analyticsError(
      "ANALYTICS_RANGE_INVALID",
      `${limits.maxDays} jours au plus`,
    )
  }
  return { from, to, days }
}

/** Rapport protégé contre la division par zéro, arrondi à 4 décimales. */
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 10_000) / 10_000
}

/**
 * Ventilation publiée : les groupes de moins de `minSize` acteurs sont
 * regroupés dans `OTHER` pour ne pas exposer de comportement individuel.
 */
export function thresholdGroups<
  T extends { value: string; count: number; actors: number },
>(
  rows: readonly T[],
  minSize: number,
): Array<{ value: string; count: number; actors: number }> {
  const kept: Array<{ value: string; count: number; actors: number }> = []
  const other = { value: "OTHER", count: 0, actors: 0 }
  for (const row of rows) {
    if (row.actors >= minSize) {
      kept.push({ value: row.value, count: row.count, actors: row.actors })
    } else {
      other.count += row.count
      other.actors += row.actors
    }
  }
  kept.sort((a, b) => b.count - a.count)
  // Un reliquat lui-même trop petit est supprimé plutôt que publié.
  if (other.actors >= minSize) kept.push(other)
  return kept
}
