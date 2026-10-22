import type {
  ListingStatus,
  ModerationAction,
} from "../../../generated/prisma/enums"
import { can, type Actor } from "../../identity"

export const MODERATION_DECISIONS = [
  "APPROVE",
  "REJECT",
  "REQUEST_CHANGES",
  "SUSPEND",
  "RESTORE",
] as const

export type ModerationDecision = (typeof MODERATION_DECISIONS)[number]

export interface ModerationRule {
  from: readonly ListingStatus[]
  to: ListingStatus
  permission: "listing:moderate" | "listing:suspend"
  /** Motif normalisé exigé, ou `null`. */
  reasonAction: ModerationAction | null
  /** Justification interne exigée (aucun motif public ne s'applique). */
  justificationRequired: boolean
}

/**
 * Décisions du back-office, exprimées sur la machine à états du module
 * Listing (aucune transition propre) : un test vérifie que chacune y est
 * autorisée au modérateur avec la même permission.
 */
export const MODERATION_RULES: Record<ModerationDecision, ModerationRule> = {
  APPROVE: {
    from: ["PENDING_REVIEW"],
    to: "PUBLISHED",
    permission: "listing:moderate",
    reasonAction: null,
    justificationRequired: false,
  },
  REJECT: {
    from: ["PENDING_REVIEW"],
    to: "DRAFT",
    permission: "listing:moderate",
    reasonAction: "REJECT",
    justificationRequired: false,
  },
  REQUEST_CHANGES: {
    from: ["PENDING_REVIEW"],
    to: "DRAFT",
    permission: "listing:moderate",
    reasonAction: "REQUEST_CHANGES",
    justificationRequired: false,
  },
  SUSPEND: {
    from: ["PUBLISHED", "PAUSED"],
    to: "SUSPENDED",
    permission: "listing:suspend",
    reasonAction: "SUSPEND",
    justificationRequired: false,
  },
  RESTORE: {
    from: ["SUSPENDED"],
    to: "PUBLISHED",
    permission: "listing:suspend",
    reasonAction: null,
    justificationRequired: true,
  },
}

export function availableDecisions(
  actor: Actor,
  status: ListingStatus,
): ModerationDecision[] {
  return MODERATION_DECISIONS.filter((decision) => {
    const rule = MODERATION_RULES[decision]
    return rule.from.includes(status) && can(actor, rule.permission)
  })
}

/** Texte de l'historique de statut, visible du gestionnaire : jamais de note interne. */
export function historyReason(
  reasonCode: string | null,
  ownerMessage: string | null,
): string | null {
  const parts = [reasonCode, ownerMessage].filter((part): part is string =>
    Boolean(part && part.trim()),
  )
  return parts.length > 0 ? parts.join(" — ").slice(0, 500) : null
}

const NOTICE_TITLES: Record<ModerationDecision, string> = {
  APPROVE: "Annonce validée",
  REJECT: "Annonce refusée",
  REQUEST_CHANGES: "Corrections demandées sur votre annonce",
  SUSPEND: "Annonce suspendue",
  RESTORE: "Annonce rétablie",
}

/**
 * Message destiné au propriétaire : le texte du motif et, éventuellement, le
 * message public du modérateur. Jamais le commentaire interne.
 */
export function moderationNotice(
  decision: ModerationDecision,
  listingTitle: string,
  reasonMessage: string | null,
  ownerMessage: string | null,
): { title: string; body: string } {
  const subject = `« ${listingTitle.slice(0, 120)} »`
  const lead: Record<ModerationDecision, string> = {
    APPROVE: `Votre annonce ${subject} a été validée et est en ligne.`,
    REJECT: `Votre annonce ${subject} n'a pas été validée.`,
    REQUEST_CHANGES: `Votre annonce ${subject} doit être corrigée avant publication.`,
    SUSPEND: `Votre annonce ${subject} n'est plus visible pour le moment.`,
    RESTORE: `Votre annonce ${subject} est de nouveau en ligne.`,
  }
  const body = [lead[decision], reasonMessage, ownerMessage]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n\n")
  return { title: NOTICE_TITLES[decision], body: body.slice(0, 2000) }
}

// ------------------------------------------------- aide à la décision

/** Seuils des contrôles de cohérence : des indices, jamais des preuves. */
export const CHECK_THRESHOLDS = {
  minPhotos: 3,
  minDescriptionLength: 80,
  /** Comparables publiés nécessaires avant de juger un prix au m². */
  minComparables: 5,
  /** Écart au prix médian au m² au-delà duquel le prix est signalé. */
  lowPriceRatio: 0.5,
  highPriceRatio: 2,
} as const

export interface ListingFacts {
  hasCurrentPrice: boolean
  photoCount: number
  descriptionLength: number
  propertyActive: boolean
  openReports: number
  openSignals: number
  publisherIdentityVerified: boolean
  /** Prix au m² de l'annonce et médiane des comparables publiés. */
  pricePerSqm: number | null
  comparablePricePerSqm: { median: number; count: number } | null
}

export type CheckOutcome = "PASS" | "WARN" | "UNKNOWN"

export interface ConsistencyCheck {
  code: string
  outcome: CheckOutcome
  detail: string
}

export function consistencyChecks(facts: ListingFacts): ConsistencyCheck[] {
  const checks: ConsistencyCheck[] = [
    {
      code: "CURRENT_PRICE",
      outcome: facts.hasCurrentPrice ? "PASS" : "WARN",
      detail: facts.hasCurrentPrice ? "Prix courant renseigné" : "Aucun prix",
    },
    {
      code: "PHOTOS",
      outcome: facts.photoCount >= CHECK_THRESHOLDS.minPhotos ? "PASS" : "WARN",
      detail: `${facts.photoCount} photo(s) publique(s), ${CHECK_THRESHOLDS.minPhotos} attendues au moins`,
    },
    {
      code: "DESCRIPTION",
      outcome:
        facts.descriptionLength >= CHECK_THRESHOLDS.minDescriptionLength
          ? "PASS"
          : "WARN",
      detail: `${facts.descriptionLength} caractères, ${CHECK_THRESHOLDS.minDescriptionLength} attendus au moins`,
    },
    {
      code: "PROPERTY_ACTIVE",
      outcome: facts.propertyActive ? "PASS" : "WARN",
      detail: facts.propertyActive ? "Bien actif" : "Bien non actif",
    },
    {
      code: "PUBLISHER_IDENTITY",
      outcome: facts.publisherIdentityVerified ? "PASS" : "WARN",
      detail: facts.publisherIdentityVerified
        ? "Identité de l'annonceur vérifiée"
        : "Identité de l'annonceur non vérifiée",
    },
    {
      code: "OPEN_REPORTS",
      outcome: facts.openReports === 0 ? "PASS" : "WARN",
      detail:
        facts.openReports === 0
          ? "Aucun signalement en cours"
          : `${facts.openReports} signalement(s) en cours (allégations à instruire)`,
    },
    {
      code: "OPEN_SIGNALS",
      outcome: facts.openSignals === 0 ? "PASS" : "WARN",
      detail:
        facts.openSignals === 0
          ? "Aucune alerte de risque ouverte"
          : `${facts.openSignals} alerte(s) de risque ouverte(s)`,
    },
  ]
  checks.push(priceCheck(facts))
  return checks
}

function priceCheck(facts: ListingFacts): ConsistencyCheck {
  const comparables = facts.comparablePricePerSqm
  if (
    facts.pricePerSqm === null ||
    !comparables ||
    comparables.count < CHECK_THRESHOLDS.minComparables ||
    comparables.median <= 0
  ) {
    return {
      code: "PRICE_PER_SQM",
      outcome: "UNKNOWN",
      detail: "Pas assez de comparables publiés pour juger le prix",
    }
  }
  const ratio = facts.pricePerSqm / comparables.median
  const outlier =
    ratio < CHECK_THRESHOLDS.lowPriceRatio ||
    ratio > CHECK_THRESHOLDS.highPriceRatio
  return {
    code: "PRICE_PER_SQM",
    outcome: outlier ? "WARN" : "PASS",
    detail: `${Math.round(ratio * 100)} % du prix médian au m² de ${comparables.count} annonces comparables`,
  }
}
