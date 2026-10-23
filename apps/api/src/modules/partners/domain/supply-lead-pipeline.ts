import type { SupplyLeadStage } from "../../../generated/prisma/client"

/**
 * Transitions autorisées du pipeline commercial supply.
 * Une inscription (REGISTERED) n'équivaut pas à ACTIVATED.
 */
const ALLOWED: Record<SupplyLeadStage, readonly SupplyLeadStage[]> = {
  IDENTIFIED: ["TO_CONTACT", "CONTACTED", "REFUSED"],
  TO_CONTACT: ["CONTACTED", "REFUSED", "IDENTIFIED"],
  CONTACTED: ["QUALIFIED", "DEMO", "REFUSED", "TO_CONTACT"],
  QUALIFIED: ["DEMO", "REGISTERED", "REFUSED", "CONTACTED"],
  DEMO: ["QUALIFIED", "REGISTERED", "REFUSED"],
  REGISTERED: ["LISTINGS_SUBMITTED", "VERIFICATION", "REFUSED", "CHURN_RISK"],
  LISTINGS_SUBMITTED: ["VERIFICATION", "FIRST_PUBLISHED", "CHURN_RISK"],
  VERIFICATION: ["FIRST_PUBLISHED", "LISTINGS_SUBMITTED", "CHURN_RISK"],
  FIRST_PUBLISHED: ["ACTIVATED", "NURTURE", "CHURN_RISK"],
  ACTIVATED: ["NURTURE", "CHURN_RISK"],
  NURTURE: ["ACTIVATED", "CHURN_RISK", "TO_CONTACT"],
  REFUSED: ["TO_CONTACT", "IDENTIFIED"],
  CHURN_RISK: ["NURTURE", "TO_CONTACT", "ACTIVATED", "REFUSED"],
}

/** Activation = au moins une annonce publiée / active, pas la seule inscription. */
export function isActivatedStage(stage: SupplyLeadStage): boolean {
  return stage === "ACTIVATED" || stage === "NURTURE"
}

export function canTransitionSupplyLeadStage(
  from: SupplyLeadStage,
  to: SupplyLeadStage,
): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export function assertSupplyLeadStageTransition(
  from: SupplyLeadStage,
  to: SupplyLeadStage,
): void {
  if (!canTransitionSupplyLeadStage(from, to)) {
    throw new Error(`Transition supply lead interdite : ${from} → ${to}`)
  }
}
