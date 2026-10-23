import type {
  OwnershipType,
  TrustSignalSeverity,
} from "../../../generated/prisma/enums"

/**
 * Règles de risque déterministes. Chacune produit une alerte à examiner par
 * un humain, jamais une conclusion : aucune ne suspend, ne rejette ni ne
 * révoque quoi que ce soit. Aucune ne s'appuie sur une caractéristique
 * sensible (nom, origine, quartier, âge du compte...).
 */
export const RiskRule = {
  /** Même fichier (empreinte SHA-256) déjà envoyé par un autre compte. */
  DUPLICATE_DOCUMENT: "DUPLICATE_DOCUMENT",
  /** Rattachement revendiqué absent des rattachements courants du bien. */
  RELATION_NOT_ESTABLISHED: "RELATION_NOT_ESTABLISHED",
  /** Un autre compte détient déjà une propriété exclusive vérifiée sur le bien. */
  CONFLICTING_OWNERSHIP: "CONFLICTING_OWNERSHIP",
  /** Plusieurs déclarants distincts signalent la même cible. */
  REPORT_THRESHOLD: "REPORT_THRESHOLD",
  /** Variation de prix très forte sur une annonce publiée. */
  PRICE_CHANGE_ANOMALY: "PRICE_CHANGE_ANOMALY",
  /** Un modérateur demande le réexamen des vérifications après un signalement confirmé. */
  REPORT_REVIEW_REQUESTED: "REPORT_REVIEW_REQUESTED",
  /** Création rapide de nombreuses annonces par un même compte (revue, pas de sanction auto). */
  ACCOUNT_BURST_ACTIVITY: "ACCOUNT_BURST_ACTIVITY",
  /** Même bien, même type d'offre, plusieurs annonces publiées. */
  DUPLICATE_LISTING_SAME_PROPERTY: "DUPLICATE_LISTING_SAME_PROPERTY",
  /** Empreinte SHA-256 d'une photo déjà envoyée par un autre compte. */
  DUPLICATE_MEDIA_CROSS_ACCOUNT: "DUPLICATE_MEDIA_CROSS_ACCOUNT",
  /** Modification notable d'une annonce déjà contrôlée (LISTING_CONSISTENCY). */
  MATERIAL_CHANGE_AFTER_VERIFICATION: "MATERIAL_CHANGE_AFTER_VERIFICATION",
  /** Message demandant un secret de connexion (OTP, mot de passe). */
  MESSAGE_CREDENTIAL_HARVEST: "MESSAGE_CREDENTIAL_HARVEST",
  /** Message se présentant comme le support officiel. */
  MESSAGE_FAKE_SUPPORT: "MESSAGE_FAKE_SUPPORT",
} as const

export type RiskRule = (typeof RiskRule)[keyof typeof RiskRule]

export const RULE_SEVERITY: Record<RiskRule, TrustSignalSeverity> = {
  DUPLICATE_DOCUMENT: "HIGH",
  RELATION_NOT_ESTABLISHED: "MEDIUM",
  CONFLICTING_OWNERSHIP: "HIGH",
  REPORT_THRESHOLD: "MEDIUM",
  PRICE_CHANGE_ANOMALY: "MEDIUM",
  REPORT_REVIEW_REQUESTED: "HIGH",
  ACCOUNT_BURST_ACTIVITY: "MEDIUM",
  DUPLICATE_LISTING_SAME_PROPERTY: "MEDIUM",
  DUPLICATE_MEDIA_CROSS_ACCOUNT: "HIGH",
  MATERIAL_CHANGE_AFTER_VERIFICATION: "MEDIUM",
  MESSAGE_CREDENTIAL_HARVEST: "HIGH",
  MESSAGE_FAKE_SUPPORT: "HIGH",
}

export interface Prechecks {
  /** Groupes de pièces obligatoires couverts. */
  requiredDocuments: boolean
  /** Pièces dont l'analyse antivirus n'a pas été faite (aucun antivirus branché). */
  unscannedDocuments: number
  phoneVerified: boolean
  emailVerified: boolean
  identityVerified: boolean | null
  relationEstablished: boolean | null
  duplicateDocuments: number
  conflictingOwnership: boolean | null
  computedAt: string
}

export interface PrecheckInput {
  requiredDocumentsCovered: boolean
  unscannedDocuments: number
  phoneVerified: boolean
  emailVerified: boolean
  /** Nul quand le type ne l'exige pas. */
  identityVerified: boolean | null
  claimedRelation: OwnershipType | null
  /** Rattachements courants du déclarant sur le bien ; nul hors bien. */
  currentRelations: readonly OwnershipType[] | null
  /** Autres comptes ayant envoyé un fichier identique. */
  duplicateUploaders: number
  /** Autres comptes avec une propriété SOLE vérifiée et valide sur le bien. */
  otherSoleOwners: number | null
}

export interface RiskFinding {
  rule: RiskRule
  severity: TrustSignalSeverity
  details: Record<string, string | number | boolean>
}

/**
 * Précontrôles d'un dossier soumis : aide à l'instruction, réservée aux
 * relecteurs. Une pièce non analysée n'est pas une anomalie, juste un fait.
 */
export function runPrechecks(
  input: PrecheckInput,
  now: Date,
): { prechecks: Prechecks; findings: RiskFinding[] } {
  const relationEstablished =
    input.claimedRelation && input.currentRelations
      ? input.currentRelations.includes(input.claimedRelation)
      : null
  const conflictingOwnership =
    input.otherSoleOwners === null ? null : input.otherSoleOwners > 0
  const findings: RiskFinding[] = []
  if (input.duplicateUploaders > 0) {
    findings.push({
      rule: RiskRule.DUPLICATE_DOCUMENT,
      severity: RULE_SEVERITY.DUPLICATE_DOCUMENT,
      details: { otherAccounts: input.duplicateUploaders },
    })
  }
  if (relationEstablished === false) {
    findings.push({
      rule: RiskRule.RELATION_NOT_ESTABLISHED,
      severity: RULE_SEVERITY.RELATION_NOT_ESTABLISHED,
      details: { claimedRelation: input.claimedRelation! },
    })
  }
  if (conflictingOwnership) {
    findings.push({
      rule: RiskRule.CONFLICTING_OWNERSHIP,
      severity: RULE_SEVERITY.CONFLICTING_OWNERSHIP,
      details: { otherVerifiedOwners: input.otherSoleOwners! },
    })
  }
  return {
    prechecks: {
      requiredDocuments: input.requiredDocumentsCovered,
      unscannedDocuments: input.unscannedDocuments,
      phoneVerified: input.phoneVerified,
      emailVerified: input.emailVerified,
      identityVerified: input.identityVerified,
      relationEstablished,
      duplicateDocuments: input.duplicateUploaders,
      conflictingOwnership,
      computedAt: now.toISOString(),
    },
    findings,
  }
}

/** Seuil de déclarants distincts atteint (pas le nombre brut de signalements). */
export function reportThresholdReached(
  distinctReporters: number,
  threshold: number,
): boolean {
  return distinctReporters >= threshold
}

/** Variation relative du prix au-delà du ratio (0,5 : baisse ou hausse de plus de 50 %). */
export function isPriceChangeAnomaly(
  oldAmount: number,
  newAmount: number,
  ratio: number,
): boolean {
  if (!(oldAmount > 0) || !(newAmount > 0)) return false
  return Math.abs(newAmount - oldAmount) / oldAmount > ratio
}

/** Pic de création d'annonces : signal de revue, jamais une preuve de fraude. */
export function isListingBurst(
  createdInWindow: number,
  threshold: number,
): boolean {
  return createdInWindow >= threshold && threshold > 0
}
