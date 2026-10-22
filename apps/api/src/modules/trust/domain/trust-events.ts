/**
 * Événements publiés après commit. Charges utiles : identifiants publics,
 * types, statuts et codes de motif ; jamais de note interne, de détail
 * antifraude, de clé de stockage ni de donnée personnelle.
 */
export const TrustEvent = {
  VERIFICATION_CREATED: "trust.verification_created",
  VERIFICATION_SUBMITTED: "trust.verification_submitted",
  VERIFICATION_ASSIGNED: "trust.verification_assigned",
  VERIFICATION_INFORMATION_REQUESTED:
    "trust.verification_information_requested",
  VERIFICATION_APPROVED: "trust.verification_approved",
  VERIFICATION_REJECTED: "trust.verification_rejected",
  VERIFICATION_REVOKED: "trust.verification_revoked",
  VERIFICATION_EXPIRED: "trust.verification_expired",
  VERIFICATION_WITHDRAWN: "trust.verification_withdrawn",
  VERIFICATION_ESCALATED: "trust.verification_escalated",
  REPORT_CREATED: "trust.report_created",
  REPORT_RESOLVED: "trust.report_resolved",
  SIGNAL_RAISED: "trust.signal_raised",
  SIGNAL_REVIEWED: "trust.signal_reviewed",
  /** Badges ou score d'un utilisateur, d'un bien ou d'une annonce à recalculer. */
  TRUST_CHANGED: "trust.changed",
} as const

export const TrustAuditAction = {
  VERIFICATION_CREATED: "VERIFICATION_CREATED",
  VERIFICATION_DOCUMENT_ADDED: "VERIFICATION_DOCUMENT_ADDED",
  VERIFICATION_DOCUMENT_REMOVED: "VERIFICATION_DOCUMENT_REMOVED",
  VERIFICATION_SUBMITTED: "VERIFICATION_SUBMITTED",
  VERIFICATION_WITHDRAWN: "VERIFICATION_WITHDRAWN",
  VERIFICATION_ASSIGNED: "VERIFICATION_ASSIGNED",
  VERIFICATION_INFORMATION_REQUESTED: "VERIFICATION_INFORMATION_REQUESTED",
  VERIFICATION_APPROVED: "VERIFICATION_APPROVED",
  VERIFICATION_REJECTED: "VERIFICATION_REJECTED",
  VERIFICATION_REVOKED: "VERIFICATION_REVOKED",
  VERIFICATION_EXPIRED: "VERIFICATION_EXPIRED",
  VERIFICATION_ESCALATED: "VERIFICATION_ESCALATED",
  VERIFICATION_VIEWED: "VERIFICATION_VIEWED",
  VERIFICATION_DOCUMENT_ACCESSED: "VERIFICATION_DOCUMENT_ACCESSED",
  REPORT_CREATED: "REPORT_CREATED",
  REPORT_ASSIGNED: "REPORT_ASSIGNED",
  REPORT_RESOLVED: "REPORT_RESOLVED",
  SIGNAL_REVIEWED: "TRUST_SIGNAL_REVIEWED",
  SCORE_VIEWED: "TRUST_SCORE_VIEWED",
} as const

/** Actions inscrites dans `verification_events` (historique du dossier). */
export const VerificationAction = {
  CREATED: "CREATED",
  DOCUMENT_ADDED: "DOCUMENT_ADDED",
  DOCUMENT_REMOVED: "DOCUMENT_REMOVED",
  SUBMITTED: "SUBMITTED",
  RESUBMITTED: "RESUBMITTED",
  WITHDRAWN: "WITHDRAWN",
  ASSIGNED: "ASSIGNED",
  UNASSIGNED: "UNASSIGNED",
  INFORMATION_REQUESTED: "INFORMATION_REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
  ESCALATED: "ESCALATED",
  DOCUMENTS_RETIRED: "DOCUMENTS_RETIRED",
} as const

export const VERIFICATION_ENTITY = "verification"
export const REPORT_ENTITY = "report"
export const TRUST_SIGNAL_ENTITY = "trust_signal"
export const TRUST_SCORE_ENTITY = "trust_score"
