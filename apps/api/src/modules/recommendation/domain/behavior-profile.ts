import type { BehaviorSignals } from "./recommendation-input"

export const BEHAVIOR_MODEL_VERSION = "behavior-v1"

export type BehaviorSignalKind =
  | "FAVORITE"
  | "INQUIRY"
  | "APPOINTMENT"
  | "VIEW"
  | "SEARCH"
  | "RECOMMENDATION_CLICKED"
  | "RECOMMENDATION_INTERESTED"

/** Poids de base : plus l'action engage, plus elle pèse. */
export const SIGNAL_WEIGHTS: Record<BehaviorSignalKind, number> = {
  FAVORITE: 5,
  INQUIRY: 6,
  APPOINTMENT: 8,
  VIEW: 1,
  SEARCH: 2,
  RECOMMENDATION_CLICKED: 2,
  RECOMMENDATION_INTERESTED: 4,
}

/** Consultation trop brève : clic accidentel, ignorée. */
export const MIN_VIEW_MS = 2_000
/** Consultation attentive : poids doublé. */
export const LONG_VIEW_MS = 30_000
/** Consultations répétées d'un même bien prises en compte. */
export const MAX_VIEWS_PER_PROPERTY = 3
/** Tolérance d'horloge : au-delà, un événement daté du futur est rejeté. */
const CLOCK_SKEW_MS = 5 * 60_000
const MIN_WEIGHT = 0.05
const MAX_ENTRIES = 20
const DAY_MS = 86_400_000

/** Un signal et les caractéristiques de ce qu'il vise (bien ou recherche). */
export interface BehaviorSignal {
  kind: BehaviorSignalKind
  occurredAt: Date
  /** Bien visé ; absent pour une recherche. */
  propertyId: bigint | null
  durationMs: number | null
  neighborhoodId: number | null
  communeId: number | null
  propertyTypeCode: string | null
  amenityCodes: string[]
}

export interface BehaviorOptions {
  asOf: Date
  lookbackDays: number
  halfLifeDays: number
}

export interface BehaviorProfile {
  signals: BehaviorSignals
  /** Signaux retenus après filtrage. */
  signalCount: number
}

/**
 * Agrège l'activité en poids 0..1 par lieu, type et équipement. Pure et
 * déterministe : décroissance exponentielle (demi-vie), fenêtre glissante,
 * consultations brèves ignorées, répétitions plafonnées, événements futurs
 * rejetés. Ne déduit rien d'autre que des préférences immobilières.
 */
export function buildBehaviorProfile(
  signals: readonly BehaviorSignal[],
  options: BehaviorOptions,
): BehaviorProfile {
  const now = options.asOf.getTime()
  const oldest = now - options.lookbackDays * DAY_MS
  const valid = signals
    .filter((signal) => {
      const at = signal.occurredAt.getTime()
      if (Number.isNaN(at) || at > now + CLOCK_SKEW_MS || at < oldest)
        return false
      if (signal.kind === "VIEW" && signal.durationMs !== null) {
        return signal.durationMs >= MIN_VIEW_MS
      }
      return true
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

  const viewsPerProperty = new Map<bigint, number>()
  const neighborhoods = new Map<string, number>()
  const communes = new Map<string, number>()
  const propertyTypes = new Map<string, number>()
  const amenities = new Map<string, number>()
  let signalCount = 0

  for (const signal of valid) {
    if (signal.kind === "VIEW" && signal.propertyId !== null) {
      const seen = viewsPerProperty.get(signal.propertyId) ?? 0
      if (seen >= MAX_VIEWS_PER_PROPERTY) continue
      viewsPerProperty.set(signal.propertyId, seen + 1)
    }
    let base = SIGNAL_WEIGHTS[signal.kind]
    if (signal.kind === "VIEW" && (signal.durationMs ?? 0) >= LONG_VIEW_MS) {
      base *= 2
    }
    const ageDays = Math.max(0, (now - signal.occurredAt.getTime()) / DAY_MS)
    const weight = base * Math.pow(0.5, ageDays / options.halfLifeDays)
    signalCount += 1
    if (signal.neighborhoodId !== null) {
      add(neighborhoods, String(signal.neighborhoodId), weight)
    }
    if (signal.communeId !== null)
      add(communes, String(signal.communeId), weight)
    if (signal.propertyTypeCode !== null) {
      add(propertyTypes, signal.propertyTypeCode, weight)
    }
    for (const code of signal.amenityCodes) add(amenities, code, weight)
  }

  return {
    signals: {
      neighborhoods: normalize(neighborhoods),
      communes: normalize(communes),
      propertyTypes: normalize(propertyTypes),
      amenities: normalize(amenities),
    },
    signalCount,
  }
}

function add(map: Map<string, number>, key: string, weight: number): void {
  map.set(key, (map.get(key) ?? 0) + weight)
}

/** Maximum ramené à 1, petits poids écartés, 20 entrées au plus (ordre stable). */
function normalize(map: Map<string, number>): Record<string, number> {
  const max = Math.max(0, ...map.values())
  if (max <= 0) return {}
  const entries = [...map.entries()]
    .map(
      ([key, value]) => [key, Math.round((value / max) * 1000) / 1000] as const,
    )
    .filter(([, value]) => value >= MIN_WEIGHT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_ENTRIES)
  return Object.fromEntries(entries)
}

/** Relit un profil stocké en JSON ; toute valeur inattendue est ignorée. */
export function parseBehaviorSignals(stored: {
  preferredLocations: unknown
  preferredPropertyTypes: unknown
  preferredAmenities: unknown
}): BehaviorSignals {
  const locations = asRecord(stored.preferredLocations)
  return {
    neighborhoods: weights(locations.neighborhoods),
    communes: weights(locations.communes),
    propertyTypes: weights(stored.preferredPropertyTypes),
    amenities: weights(stored.preferredAmenities),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function weights(value: unknown): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [key, weight] of Object.entries(asRecord(value))) {
    if (typeof weight === "number" && weight > 0 && weight <= 1) {
      result[key] = weight
    }
  }
  return result
}
