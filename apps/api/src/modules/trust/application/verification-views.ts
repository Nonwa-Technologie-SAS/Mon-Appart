import type {
  MediaStatus,
  OwnershipType,
  TrustActorKind,
  VerificationDocumentStatus,
  VerificationDocumentType,
  VerificationPriority,
  VerificationStatus,
  VerificationType,
} from "../../../generated/prisma/enums"
import { reasonMessage } from "../domain/reason-codes"
import {
  documentRequirement,
  isRequestableType,
  missingDocumentGroups,
} from "../domain/verification-requirements"
import type {
  VerificationEventRow,
  VerificationRow,
} from "../infrastructure/trust.repository"

export interface DocumentView {
  id: string
  documentType: VerificationDocumentType
  status: VerificationDocumentStatus
  /** Identifiant de la session d'envoi Media (confirmation, suivi). */
  uploadId: string
  uploadStatus: MediaStatus
  createdAt: Date
  reviewedAt: Date | null
}

export interface RequirementView {
  accepted: VerificationDocumentType[]
  required: VerificationDocumentType[][]
  missing: VerificationDocumentType[][]
}

export interface HistoryEntryView {
  action: string
  status: VerificationStatus
  reason: { code: string; message: string } | null
  message: string | null
  at: Date
}

/** Vue du déclarant : ni précontrôle, ni note interne, ni identité des relecteurs. */
export interface VerificationView {
  id: string
  type: VerificationType
  status: VerificationStatus
  propertyId: string | null
  listingId: string | null
  claimedRelation: OwnershipType | null
  reason: { code: string; message: string } | null
  declaration: Record<string, unknown>
  attestedAt: Date | null
  submittedAt: Date | null
  decidedAt: Date | null
  verifiedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  documents: DocumentView[]
  requirements: RequirementView | null
  history: HistoryEntryView[]
}

export interface ReviewDocumentView extends DocumentView {
  mimeType: string
  fileSize: number
  /** `NOT_SCANNED` : aucun antivirus n'est branché, rien n'est affirmé. */
  scan: string | null
}

export interface ReviewHistoryEntryView extends HistoryEntryView {
  actorKind: TrustActorKind
  actorId: string | null
  internalNote: string | null
}

export interface ReviewSignalView {
  id: string
  ruleCode: string
  severity: string
  status: string
  createdAt: Date
}

export interface ReviewVerificationView extends Omit<
  VerificationView,
  "documents" | "history"
> {
  priority: VerificationPriority
  assignedTo: string | null
  subject: {
    userId: string
    firstName: string | null
    lastName: string | null
    phoneVerified: boolean
    emailVerified: boolean
  }
  property: { id: string; title: string } | null
  listing: { id: string; title: string } | null
  /** Aide à l'instruction, jamais une conclusion. */
  prechecks: Record<string, unknown>
  documents: ReviewDocumentView[]
  history: ReviewHistoryEntryView[]
  signals: ReviewSignalView[]
}

export interface ReviewQueueItemView {
  id: string
  type: VerificationType
  status: VerificationStatus
  priority: VerificationPriority
  assignedTo: string | null
  subjectId: string
  propertyId: string | null
  listingId: string | null
  documents: number
  submittedAt: Date | null
  createdAt: Date
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

function reasonOf(code: string | null) {
  const message = reasonMessage(code)
  return code && message ? { code, message } : null
}

function documentView(doc: VerificationRow["documents"][number]): DocumentView {
  return {
    id: doc.publicId,
    documentType: doc.documentType,
    status: doc.status,
    uploadId: doc.media.publicId,
    uploadStatus: doc.media.status,
    createdAt: doc.createdAt,
    reviewedAt: doc.reviewedAt,
  }
}

/** Pièces prises en compte : non retirées et prêtes (contrôle Media réussi). */
export function readyDocumentTypes(
  row: VerificationRow,
): VerificationDocumentType[] {
  return row.documents
    .filter(
      (doc) =>
        doc.status !== "REMOVED" &&
        doc.status !== "REJECTED" &&
        doc.media.status === "READY" &&
        doc.media.deletedAt === null,
    )
    .map((doc) => doc.documentType)
}

export function requirementView(row: VerificationRow): RequirementView | null {
  if (!isRequestableType(row.type)) return null
  const requirement = documentRequirement(
    row.type,
    row.property?.propertyType.category ?? null,
  )
  return {
    accepted: [...requirement.accepted],
    required: requirement.required.map((group) => [...group]),
    missing: missingDocumentGroups(requirement, readyDocumentTypes(row)).map(
      (group) => [...group],
    ),
  }
}

function historyEntry(event: VerificationEventRow): HistoryEntryView {
  return {
    action: event.action,
    status: event.toStatus,
    reason: reasonOf(event.reasonCode),
    message: event.userMessage,
    at: event.createdAt,
  }
}

export function verificationView(
  row: VerificationRow,
  events: readonly VerificationEventRow[],
): VerificationView {
  return {
    id: row.publicId,
    type: row.type,
    status: row.status,
    propertyId: row.property?.publicId ?? null,
    listingId: row.listing?.publicId ?? null,
    claimedRelation: row.claimedRelation,
    reason: reasonOf(row.reasonCode),
    declaration: asObject(row.declaration),
    attestedAt: row.attestedAt,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    verifiedAt: row.verifiedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    documents: row.documents
      .filter((doc) => doc.status !== "REMOVED")
      .map(documentView),
    requirements: requirementView(row),
    history: events.map(historyEntry),
  }
}

export function reviewVerificationView(
  row: VerificationRow,
  events: readonly VerificationEventRow[],
  signals: ReviewSignalView[],
): ReviewVerificationView {
  const base = verificationView(row, events)
  return {
    ...base,
    priority: row.priority,
    assignedTo: row.assignedTo?.publicId ?? null,
    subject: {
      userId: row.user.publicId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      phoneVerified: row.user.phoneVerifiedAt !== null,
      emailVerified: row.user.emailVerifiedAt !== null,
    },
    property: row.property
      ? { id: row.property.publicId, title: row.property.title }
      : null,
    listing: row.listing
      ? { id: row.listing.publicId, title: row.listing.title }
      : null,
    prechecks: asObject(row.prechecks),
    documents: row.documents.map((doc) => ({
      ...documentView(doc),
      mimeType: doc.media.mimeType,
      fileSize: Number(doc.media.fileSize),
      scan: (asObject(doc.media.metadata).scan as string | undefined) ?? null,
    })),
    history: events.map((event) => ({
      ...historyEntry(event),
      actorKind: event.actorKind,
      actorId: event.actor?.publicId ?? null,
      internalNote: event.internalNote,
    })),
    signals,
  }
}

export function reviewQueueItem(row: VerificationRow): ReviewQueueItemView {
  return {
    id: row.publicId,
    type: row.type,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assignedTo?.publicId ?? null,
    subjectId: row.user.publicId,
    propertyId: row.property?.publicId ?? null,
    listingId: row.listing?.publicId ?? null,
    documents: row.documents.filter((doc) => doc.status !== "REMOVED").length,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
  }
}
