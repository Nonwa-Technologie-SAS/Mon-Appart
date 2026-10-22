import { can, type Actor } from "../../identity"
import { trustError } from "./trust-errors"

export type ReviewAction =
  | "VIEW"
  | "ASSIGN"
  | "REQUEST_INFORMATION"
  | "ESCALATE"
  | "APPROVE"
  | "REJECT"
  | "REVOKE"

/**
 * Permissions exigées par action. Instruire (MODERATOR) ne permet pas de
 * décider (TRUST_OFFICER) ; une décision sur pièces exige aussi le droit de
 * les consulter : on ne valide pas ce qu'on n'a pas pu voir.
 */
export function requiredPermissions(
  action: ReviewAction,
  hasDocuments: boolean,
): string[] {
  const documents = hasDocuments ? ["verification:documents"] : []
  switch (action) {
    case "VIEW":
      return ["verification:read"]
    case "ASSIGN":
    case "REQUEST_INFORMATION":
    case "ESCALATE":
      return ["verification:review"]
    case "APPROVE":
      return ["verification:approve", ...documents]
    case "REJECT":
      return ["verification:reject", ...documents]
    case "REVOKE":
      return ["verification:revoke"]
  }
}

export function assertCanReview(
  actor: Actor,
  action: ReviewAction,
  hasDocuments: boolean,
): void {
  const missing = requiredPermissions(action, hasDocuments).filter(
    (permission) => !can(actor, permission),
  )
  if (missing.length > 0) {
    throw trustError("DECISION_PERMISSION_REQUIRED", missing.join(", "))
  }
}

/**
 * Indépendance du relecteur : jamais sur son propre dossier, ni sur un bien
 * auquel il est rattaché. S'applique à toute action d'instruction, pas
 * seulement à l'approbation.
 */
export function assertIndependentReviewer(
  reviewerId: bigint,
  subject: { userId: bigint; reviewerIsLinkedToProperty: boolean },
): void {
  if (subject.userId === reviewerId) {
    throw trustError("SELF_REVIEW_FORBIDDEN")
  }
  if (subject.reviewerIsLinkedToProperty) {
    throw trustError("CONFLICT_OF_INTEREST")
  }
}
