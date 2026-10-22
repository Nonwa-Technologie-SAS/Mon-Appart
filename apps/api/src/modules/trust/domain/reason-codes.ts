/**
 * Motifs normalisés des décisions. Le message associé est le seul texte de
 * motif montré au déclarant : neutre, sans détail antifraude. Le relecteur
 * peut ajouter un message libre (pièce attendue) ; sa note interne reste
 * réservée aux relecteurs.
 */
export const INFORMATION_REASONS = {
  MISSING_DOCUMENT: "Une pièce justificative est manquante.",
  DOCUMENT_ILLEGIBLE: "Une pièce est illisible ou incomplète.",
  DOCUMENT_EXPIRED: "Une pièce n'est plus en cours de validité.",
  CLARIFICATION_NEEDED:
    "Des précisions sont nécessaires pour poursuivre l'examen.",
} as const

export const REJECTION_REASONS = {
  DOCUMENT_ILLEGIBLE: "Les pièces fournies ne sont pas exploitables.",
  DOCUMENT_EXPIRED: "Les pièces fournies ne sont plus en cours de validité.",
  DOCUMENT_MISMATCH:
    "Les pièces fournies ne correspondent pas aux informations du dossier.",
  INSUFFICIENT_EVIDENCE:
    "Les pièces fournies ne permettent pas d'établir l'information demandée.",
  RELATION_NOT_ESTABLISHED: "Le rattachement au bien n'a pas pu être établi.",
  OTHER: "Le dossier n'a pas pu être validé.",
} as const

export const REVOCATION_REASONS = {
  NEW_EVIDENCE: "De nouveaux éléments remettent en cause la vérification.",
  CONFIRMED_REPORT: "Un signalement examiné a remis en cause la vérification.",
  RELATION_ENDED: "Le rattachement au bien a pris fin.",
  DOCUMENT_INVALIDATED: "Une pièce justificative n'est plus valable.",
  USER_REQUEST: "La vérification a été retirée à votre demande.",
  OTHER: "La vérification a été retirée.",
} as const

export type InformationReason = keyof typeof INFORMATION_REASONS
export type RejectionReason = keyof typeof REJECTION_REASONS
export type RevocationReason = keyof typeof REVOCATION_REASONS

export const INFORMATION_REASON_CODES = Object.keys(
  INFORMATION_REASONS,
) as InformationReason[]
export const REJECTION_REASON_CODES = Object.keys(
  REJECTION_REASONS,
) as RejectionReason[]
export const REVOCATION_REASON_CODES = Object.keys(
  REVOCATION_REASONS,
) as RevocationReason[]

const ALL_REASONS: Record<string, string> = {
  ...INFORMATION_REASONS,
  ...REJECTION_REASONS,
  ...REVOCATION_REASONS,
  EXPIRED:
    "La vérification est arrivée à échéance ; elle peut être renouvelée.",
}

/** Message public d'un motif ; un code inconnu ne fuit jamais tel quel. */
export function reasonMessage(code: string | null): string | null {
  if (!code) return null
  return ALL_REASONS[code] ?? "Le dossier a été mis à jour."
}
