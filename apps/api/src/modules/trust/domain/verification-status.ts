import type { VerificationStatus } from "../../../generated/prisma/enums"

/**
 * Cycle de vie d'un dossier :
 *
 *   DRAFT ──soumission──▶ PENDING ──affectation──▶ IN_REVIEW
 *                            │                        │
 *                            ├──────────┬─────────────┤
 *                            ▼          ▼             ▼
 *            NEEDS_MORE_INFORMATION  VERIFIED     REJECTED
 *                 │ (nouvelle soumission)  │
 *                 └──────▶ PENDING         ├──▶ REVOKED
 *                                          └──▶ EXPIRED
 *
 * WITHDRAWN : retrait par le déclarant tant qu'aucune décision n'est prise.
 */
const TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  DRAFT: ["PENDING", "WITHDRAWN"],
  PENDING: [
    "IN_REVIEW",
    "NEEDS_MORE_INFORMATION",
    "VERIFIED",
    "REJECTED",
    "WITHDRAWN",
  ],
  IN_REVIEW: [
    "PENDING",
    "NEEDS_MORE_INFORMATION",
    "VERIFIED",
    "REJECTED",
    "WITHDRAWN",
  ],
  NEEDS_MORE_INFORMATION: ["PENDING", "WITHDRAWN"],
  VERIFIED: ["REVOKED", "EXPIRED"],
  REJECTED: [],
  REVOKED: [],
  EXPIRED: [],
  WITHDRAWN: [],
}

export function canTransitionVerification(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Dossiers en cours : un seul par déclarant, type et cible. */
export const OPEN_VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "DRAFT",
  "PENDING",
  "IN_REVIEW",
  "NEEDS_MORE_INFORMATION",
]

/** File de relecture : soumis et pas encore décidés. */
export const REVIEWABLE_STATUSES: readonly VerificationStatus[] = [
  "PENDING",
  "IN_REVIEW",
]

/** Le déclarant peut ajouter ou retirer des pièces. */
export const EDITABLE_STATUSES: readonly VerificationStatus[] = [
  "DRAFT",
  "NEEDS_MORE_INFORMATION",
]

export const isOpenVerification = (status: VerificationStatus) =>
  OPEN_VERIFICATION_STATUSES.includes(status)

/** Clos sans décision favorable durable : les pièces suivent la rétention. */
export const CLOSED_STATUSES: readonly VerificationStatus[] = [
  "REJECTED",
  "REVOKED",
  "EXPIRED",
  "WITHDRAWN",
]

/** Seul un dossier approuvé et non échu prouve quelque chose. */
export function isValidVerification(
  verification: { status: VerificationStatus; expiresAt: Date | null },
  now: Date,
): boolean {
  return (
    verification.status === "VERIFIED" &&
    (verification.expiresAt === null || verification.expiresAt > now)
  )
}
