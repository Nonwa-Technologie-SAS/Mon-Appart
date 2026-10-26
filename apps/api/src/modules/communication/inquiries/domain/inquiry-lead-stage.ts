import type { InquiryLeadStage } from "../../../../generated/prisma/client"

/**
 * Transitions du pipeline commercial (Inquiry = lead).
 * CONVERTED n'est jamais automatique : déclaration explicite, pas une vente.
 */
const ALLOWED: Record<InquiryLeadStage, readonly InquiryLeadStage[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "VISIT_PLANNED", "LOST", "ARCHIVED"],
  CONTACTED: ["QUALIFIED", "VISIT_PLANNED", "FOLLOW_UP", "LOST", "ARCHIVED"],
  QUALIFIED: ["VISIT_PLANNED", "FOLLOW_UP", "CONTACTED", "LOST", "ARCHIVED"],
  VISIT_PLANNED: ["VISIT_DONE", "FOLLOW_UP", "QUALIFIED", "LOST", "ARCHIVED"],
  VISIT_DONE: ["FOLLOW_UP", "CONVERTED", "LOST", "ARCHIVED"],
  FOLLOW_UP: ["QUALIFIED", "VISIT_PLANNED", "CONVERTED", "LOST", "ARCHIVED"],
  CONVERTED: ["ARCHIVED", "FOLLOW_UP"],
  LOST: ["NEW", "FOLLOW_UP", "ARCHIVED"],
  ARCHIVED: ["NEW", "FOLLOW_UP"],
}

export const TERMINAL_STAGES: ReadonlySet<InquiryLeadStage> = new Set([
  "CONVERTED",
  "LOST",
  "ARCHIVED",
])

export function canTransitionInquiryStage(
  from: InquiryLeadStage,
  to: InquiryLeadStage,
): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export function suggestedStageAfterFirstReply(
  current: InquiryLeadStage,
): InquiryLeadStage | null {
  return current === "NEW" ? "CONTACTED" : null
}

export function suggestedStageAfterVisit(
  current: InquiryLeadStage,
  event: "CONFIRMED" | "COMPLETED",
): InquiryLeadStage | null {
  if (event === "CONFIRMED") {
    if (
      current === "NEW" ||
      current === "CONTACTED" ||
      current === "QUALIFIED" ||
      current === "FOLLOW_UP"
    ) {
      return "VISIT_PLANNED"
    }
  }
  if (event === "COMPLETED" && current === "VISIT_PLANNED") {
    return "VISIT_DONE"
  }
  return null
}
