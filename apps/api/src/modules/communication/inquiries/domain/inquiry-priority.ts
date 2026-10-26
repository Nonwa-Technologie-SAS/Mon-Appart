export type InquiryPriority = "HIGH" | "MEDIUM" | "LOW"

export interface InquiryPriorityInput {
  stage: string
  status: string
  createdAt: Date
  nextActionAt: Date | null
  budgetAmount: bigint | null
  listingPrice: bigint | null
  hasPendingVisit: boolean
  hasConfirmedVisit: boolean
  firstRespondedAt: Date | null
  now: Date
}

export interface InquiryPriorityResult {
  priority: InquiryPriority
  score: number
  reasons: string[]
  suggestedAction: string
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * Règles explicites, testables. Pas de ML, pas de scoring sur des
 * caractéristiques sensibles, pas de solvabilité déduite.
 */
export function prioritizeInquiry(
  input: InquiryPriorityInput,
): InquiryPriorityResult {
  const reasons: string[] = []
  let score = 0
  const ageMs = Math.max(0, input.now.getTime() - input.createdAt.getTime())

  if (input.hasPendingVisit) {
    score += 40
    reasons.push("Une visite attend une confirmation")
  }
  if (input.hasConfirmedVisit) {
    score += 20
    reasons.push("Une visite est confirmée")
  }
  if (input.status === "OPEN" && !input.firstRespondedAt) {
    score += 25
    reasons.push("Demande sans réponse")
    if (ageMs > 24 * HOUR) {
      score += 20
      reasons.push("Sans réponse depuis plus de 24 h")
    }
  }
  if (
    input.nextActionAt &&
    input.nextActionAt.getTime() <= input.now.getTime() &&
    input.stage !== "LOST" &&
    input.stage !== "ARCHIVED" &&
    input.stage !== "CONVERTED"
  ) {
    score += 18
    reasons.push("Prochaine action échue")
  }
  if (
    input.budgetAmount !== null &&
    input.listingPrice !== null &&
    input.listingPrice > 0n
  ) {
    const ratio = Number(input.budgetAmount) / Number(input.listingPrice)
    if (ratio >= 0.8 && ratio <= 1.25) {
      score += 12
      reasons.push("Budget déclaré proche du prix affiché")
    }
  }
  if (ageMs < 6 * HOUR && input.status === "OPEN") {
    score += 8
    reasons.push("Contact récent")
  }
  if (input.stage === "CONVERTED" || input.stage === "ARCHIVED") {
    score = Math.min(score, 10)
  }
  if (input.stage === "LOST") {
    score = Math.min(score, 5)
  }

  const priority: InquiryPriority =
    score >= 45 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW"

  return {
    priority,
    score,
    reasons: reasons.length ? reasons : ["Suivi standard"],
    suggestedAction: suggestAction(input, ageMs),
  }
}

function suggestAction(input: InquiryPriorityInput, ageMs: number): string {
  if (input.hasPendingVisit) return "Confirmer ou proposer un autre créneau"
  if (input.status === "OPEN" && !input.firstRespondedAt) {
    return ageMs > DAY
      ? "Répondre maintenant — demande en attente"
      : "Répondre à la nouvelle demande"
  }
  if (input.hasConfirmedVisit) return "Préparer la visite ou envoyer un rappel"
  if (input.stage === "VISIT_DONE") return "Relancer après la visite"
  if (input.stage === "NEW" || input.stage === "CONTACTED") {
    return "Qualifier le besoin (budget, zone, délai)"
  }
  if (
    input.nextActionAt &&
    input.nextActionAt.getTime() <= input.now.getTime()
  ) {
    return "Exécuter la prochaine action prévue"
  }
  return "Mettre à jour le suivi"
}
