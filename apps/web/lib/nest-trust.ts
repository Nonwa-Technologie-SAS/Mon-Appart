import { nestServerFetch } from "@/lib/nest-session"
import type {
  NestDocumentUpload,
  NestUserBadge,
  NestVerification,
  VerificationDocumentType,
  VerificationType,
} from "@/lib/nest-trust-shared"

export type {
  NestDocumentUpload,
  NestUserBadge,
  NestVerification,
  NestVerificationDocument,
  VerificationDocumentType,
  VerificationStatus,
  VerificationType,
} from "@/lib/nest-trust-shared"

export {
  DOCUMENT_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_TYPE_LABELS,
} from "@/lib/nest-trust-shared"

export async function listMyVerifications(): Promise<NestVerification[]> {
  const result = await nestServerFetch<{ items: NestVerification[] }>(
    "/trust/verifications",
  )
  return result.items
}

export async function getMyVerification(
  verificationId: string,
): Promise<NestVerification> {
  return nestServerFetch<NestVerification>(
    `/trust/verifications/${verificationId}`,
  )
}

export async function createVerification(body: {
  type: VerificationType
  propertyId?: string
  listingId?: string
  claimedRelation?: string
  declaration?: { statement?: string; agencyName?: string }
}): Promise<NestVerification> {
  return nestServerFetch<NestVerification>("/trust/verifications", {
    method: "POST",
    body,
  })
}

export async function addVerificationDocument(
  verificationId: string,
  body: {
    documentType: VerificationDocumentType
    mimeType: string
    size: number
    filename?: string
  },
): Promise<NestDocumentUpload> {
  return nestServerFetch<NestDocumentUpload>(
    `/trust/verifications/${verificationId}/documents`,
    { method: "POST", body },
  )
}

export async function completeMediaUpload(sessionId: string): Promise<void> {
  await nestServerFetch(`/media/upload-sessions/${sessionId}/complete`, {
    method: "POST",
  })
}

export async function removeVerificationDocument(
  verificationId: string,
  documentId: string,
): Promise<NestVerification> {
  return nestServerFetch(
    `/trust/verifications/${verificationId}/documents/${documentId}`,
    { method: "DELETE" },
  )
}

export async function submitVerification(
  verificationId: string,
): Promise<NestVerification> {
  return nestServerFetch(`/trust/verifications/${verificationId}/submit`, {
    method: "POST",
    body: { attestation: true },
  })
}

export async function withdrawVerification(
  verificationId: string,
): Promise<NestVerification> {
  return nestServerFetch(`/trust/verifications/${verificationId}/withdraw`, {
    method: "POST",
  })
}

export async function getUserBadges(userId: string): Promise<NestUserBadge[]> {
  const result = await nestServerFetch<{ badges: NestUserBadge[] }>(
    `/trust/users/${userId}/badges`,
  )
  return result.badges ?? []
}
