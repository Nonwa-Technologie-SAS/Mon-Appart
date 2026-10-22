export const TRUST_SCORE_VERSION = "trust-v1"

/**
 * Faits retenus : uniquement des vérifications et des décisions humaines.
 * Vues, clics, favoris et ancienneté du compte n'y figurent pas : ils ne
 * prouvent rien de la fiabilité, et un nouveau compte n'est pas pénalisé.
 */
export interface TrustScoreFacts {
  phoneVerified: boolean
  emailVerified: boolean
  identityVerified: boolean
  agencyVerified: boolean
  /** Propriété ou mandat vérifié et valide sur au moins un bien. */
  publicationRightVerified: boolean
  propertyDocumentsVerified: boolean
  /** Au moins une vérification instruite (hors code à usage unique) approuvée un jour. */
  everReviewedApproved: boolean
  confirmedReports: number
  revocations: number
}

export interface ScoreFactor {
  code: string
  observed: boolean | number
  points: number
}

export interface TrustScoreResult {
  /** Nul si les données sont insuffisantes : rien n'est conclu. */
  score: number | null
  isComplete: boolean
  identityScore: number
  propertyScore: number
  behaviorScore: number
  /** Aucune donnée de transaction n'existe encore sur la plateforme. */
  transactionScore: number
  factors: ScoreFactor[]
}

const WEIGHTS = {
  PHONE_VERIFIED: 10,
  EMAIL_VERIFIED: 5,
  IDENTITY_VERIFIED: 35,
  PUBLICATION_RIGHT_VERIFIED: 25,
  PROPERTY_DOCUMENTS_VERIFIED: 15,
  NO_ADVERSE_DECISION: 10,
} as const

const PENALTIES = { CONFIRMED_REPORT: 15, REVOCATION: 20 } as const

const clamp = (value: number) => Math.max(0, Math.min(100, value))
const round = (value: number) => Math.round(value * 100) / 100

export function computeTrustScore(facts: TrustScoreFacts): TrustScoreResult {
  const identity = facts.identityVerified || facts.agencyVerified
  const clean = facts.confirmedReports === 0 && facts.revocations === 0
  const factors: ScoreFactor[] = [
    {
      code: "PHONE_VERIFIED",
      observed: facts.phoneVerified,
      points: facts.phoneVerified ? WEIGHTS.PHONE_VERIFIED : 0,
    },
    {
      code: "EMAIL_VERIFIED",
      observed: facts.emailVerified,
      points: facts.emailVerified ? WEIGHTS.EMAIL_VERIFIED : 0,
    },
    {
      code: "IDENTITY_VERIFIED",
      observed: identity,
      points: identity ? WEIGHTS.IDENTITY_VERIFIED : 0,
    },
    {
      code: "PUBLICATION_RIGHT_VERIFIED",
      observed: facts.publicationRightVerified,
      points: facts.publicationRightVerified
        ? WEIGHTS.PUBLICATION_RIGHT_VERIFIED
        : 0,
    },
    {
      code: "PROPERTY_DOCUMENTS_VERIFIED",
      observed: facts.propertyDocumentsVerified,
      points: facts.propertyDocumentsVerified
        ? WEIGHTS.PROPERTY_DOCUMENTS_VERIFIED
        : 0,
    },
    {
      code: "NO_ADVERSE_DECISION",
      observed: clean,
      points: clean ? WEIGHTS.NO_ADVERSE_DECISION : 0,
    },
    {
      code: "CONFIRMED_REPORTS",
      observed: facts.confirmedReports,
      points: -PENALTIES.CONFIRMED_REPORT * facts.confirmedReports,
    },
    {
      code: "REVOCATIONS",
      observed: facts.revocations,
      points: -PENALTIES.REVOCATION * facts.revocations,
    },
  ]
  const points = (code: string) =>
    factors.find((factor) => factor.code === code)?.points ?? 0

  const identityScore =
    ((points("PHONE_VERIFIED") +
      points("EMAIL_VERIFIED") +
      points("IDENTITY_VERIFIED")) /
      (WEIGHTS.PHONE_VERIFIED +
        WEIGHTS.EMAIL_VERIFIED +
        WEIGHTS.IDENTITY_VERIFIED)) *
    100
  const propertyScore =
    ((points("PUBLICATION_RIGHT_VERIFIED") +
      points("PROPERTY_DOCUMENTS_VERIFIED")) /
      (WEIGHTS.PUBLICATION_RIGHT_VERIFIED +
        WEIGHTS.PROPERTY_DOCUMENTS_VERIFIED)) *
    100
  const behaviorScore = clamp(
    100 - 30 * facts.confirmedReports - 40 * facts.revocations,
  )
  const total = clamp(factors.reduce((sum, factor) => sum + factor.points, 0))
  const isComplete = facts.everReviewedApproved

  return {
    score: isComplete ? round(total) : null,
    isComplete,
    identityScore: round(identityScore),
    propertyScore: round(propertyScore),
    behaviorScore: round(behaviorScore),
    transactionScore: 0,
    factors,
  }
}
