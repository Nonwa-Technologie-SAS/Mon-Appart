/** Types et libellés Trust — sûrs côté client (pas de next/headers). */

export type VerificationType =
  | "IDENTITY"
  | "PROPERTY_OWNERSHIP"
  | "OWNER_AUTHORIZATION"
  | "PROPERTY_DOCUMENT"
  | "AGENCY"
  | "LISTING_CONSISTENCY"

export type VerificationStatus =
  | "DRAFT"
  | "PENDING"
  | "IN_REVIEW"
  | "NEEDS_MORE_INFORMATION"
  | "VERIFIED"
  | "REJECTED"
  | "REVOKED"
  | "EXPIRED"
  | "WITHDRAWN"

export type VerificationDocumentType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "RESIDENCE_PERMIT"
  | "CONSULAR_CARD"
  | "TITLE_DEED"
  | "CONCESSION_DECREE"
  | "ALLOCATION_LETTER"
  | "LAND_CERTIFICATE"
  | "SALE_DEED"
  | "BUILDING_PERMIT"
  | "UTILITY_BILL"
  | "RESIDENCE_CERTIFICATE"
  | "MANDATE"
  | "POWER_OF_ATTORNEY"
  | "COMPANY_REGISTRATION"
  | "PROFESSIONAL_CARD"
  | "OTHER"

export type NestVerificationDocument = {
  id: string
  documentType: VerificationDocumentType
  status: string
  uploadId: string
  uploadStatus: string
  createdAt: string
  reviewedAt: string | null
}

export type NestVerification = {
  id: string
  type: VerificationType
  status: VerificationStatus
  propertyId: string | null
  listingId: string | null
  claimedRelation: string | null
  reason: { code: string; message: string } | null
  declaration: Record<string, unknown>
  attestedAt: string | null
  submittedAt: string | null
  decidedAt: string | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  requirements: {
    accepted: VerificationDocumentType[]
    required: VerificationDocumentType[][]
    missing: VerificationDocumentType[][]
  } | null
  documents: NestVerificationDocument[]
  history: Array<{
    action: string
    status: VerificationStatus
    reason: { code: string; message: string } | null
    message: string | null
    at: string
  }>
}

export type NestUserBadge = {
  code: string
  label: string
  verifiedAt: string
  expiresAt: string | null
}

export type NestDocumentUpload = {
  documentId: string
  upload: {
    sessionId: string
    mediaId: string
    upload?: {
      url: string
      method: "PUT"
      headers: Record<string, string>
      contentLength: number
      expiresAt: string
    }
  }
}

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  IDENTITY: "Identité",
  PROPERTY_OWNERSHIP: "Propriété du bien",
  OWNER_AUTHORIZATION: "Mandat / autorisation",
  PROPERTY_DOCUMENT: "Documents du bien",
  AGENCY: "Agence",
  LISTING_CONSISTENCY: "Cohérence d’annonce",
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente d’examen",
  IN_REVIEW: "En cours d’examen",
  NEEDS_MORE_INFORMATION: "Complément demandé",
  VERIFIED: "Approuvé",
  REJECTED: "Refusé",
  REVOKED: "Révoqué",
  EXPIRED: "Expiré",
  WITHDRAWN: "Retiré",
}

export const DOCUMENT_TYPE_LABELS: Record<VerificationDocumentType, string> = {
  NATIONAL_ID: "Carte d’identité",
  PASSPORT: "Passeport",
  RESIDENCE_PERMIT: "Titre de séjour",
  CONSULAR_CARD: "Carte consulaire",
  TITLE_DEED: "Titre foncier",
  CONCESSION_DECREE: "Arrêté de concession",
  ALLOCATION_LETTER: "Lettre d’attribution",
  LAND_CERTIFICATE: "Certificat foncier",
  SALE_DEED: "Acte de vente",
  BUILDING_PERMIT: "Permis de construire",
  UTILITY_BILL: "Facture (eau, électricité…)",
  RESIDENCE_CERTIFICATE: "Certificat de résidence",
  MANDATE: "Mandat",
  POWER_OF_ATTORNEY: "Procuration",
  COMPANY_REGISTRATION: "Registre du commerce",
  PROFESSIONAL_CARD: "Carte professionnelle",
  OTHER: "Autre pièce",
}
