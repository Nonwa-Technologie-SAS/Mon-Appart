import type {
  OwnershipType,
  PropertyCategory,
  VerificationDocumentType,
  VerificationType,
} from "../../../generated/prisma/enums"

/**
 * Types qu'un utilisateur peut demander ici. Téléphone et e-mail passent par
 * le code à usage unique d'Identity ; ADDRESS et DOCUMENT sont des types
 * historiques sans workflow.
 */
export const REQUESTABLE_TYPES = [
  "IDENTITY",
  "PROPERTY_OWNERSHIP",
  "OWNER_AUTHORIZATION",
  "PROPERTY_DOCUMENT",
  "AGENCY",
  "LISTING_CONSISTENCY",
] as const satisfies readonly VerificationType[]

export type RequestableType = (typeof REQUESTABLE_TYPES)[number]

export const isRequestableType = (
  type: VerificationType,
): type is RequestableType =>
  (REQUESTABLE_TYPES as readonly VerificationType[]).includes(type)

export type VerificationScope = "USER" | "PROPERTY" | "LISTING"

export const SCOPE_OF: Record<RequestableType, VerificationScope> = {
  IDENTITY: "USER",
  AGENCY: "USER",
  PROPERTY_OWNERSHIP: "PROPERTY",
  OWNER_AUTHORIZATION: "PROPERTY",
  PROPERTY_DOCUMENT: "PROPERTY",
  LISTING_CONSISTENCY: "LISTING",
}

/** Rattachements qu'un déclarant peut revendiquer, par type. */
export const CLAIMABLE_RELATIONS: Partial<
  Record<RequestableType, readonly OwnershipType[]>
> = {
  PROPERTY_OWNERSHIP: ["SOLE", "JOINT", "USUFRUCT"],
  OWNER_AUTHORIZATION: ["AGENT", "MANAGER"],
}

/** Une identité vérifiée est un prérequis : le dossier engage la personne. */
export const REQUIRES_VERIFIED_IDENTITY: readonly RequestableType[] = [
  "PROPERTY_OWNERSHIP",
  "OWNER_AUTHORIZATION",
  "AGENCY",
]

const IDENTITY_DOCUMENTS: readonly VerificationDocumentType[] = [
  "NATIONAL_ID",
  "PASSPORT",
  "RESIDENCE_PERMIT",
  "CONSULAR_CARD",
]

/** Titres fonciers et actes, selon la pratique ivoirienne (ACD, lettre d'attribution...). */
const LAND_TITLES: readonly VerificationDocumentType[] = [
  "TITLE_DEED",
  "CONCESSION_DECREE",
  "ALLOCATION_LETTER",
  "LAND_CERTIFICATE",
  "SALE_DEED",
]

const BUILT_PROPERTY_TITLES: readonly VerificationDocumentType[] = [
  ...LAND_TITLES,
  "BUILDING_PERMIT",
]

const SUPPORTING_PROPERTY_DOCUMENTS: readonly VerificationDocumentType[] = [
  "UTILITY_BILL",
  "RESIDENCE_CERTIFICATE",
  "OTHER",
]

export interface DocumentRequirement {
  /** Pièces acceptées dans le dossier. */
  accepted: readonly VerificationDocumentType[]
  /** Chaque groupe doit être couvert par au moins une pièce. */
  required: ReadonlyArray<readonly VerificationDocumentType[]>
}

export function documentRequirement(
  type: RequestableType,
  category: PropertyCategory | null,
): DocumentRequirement {
  switch (type) {
    case "IDENTITY":
      return { accepted: IDENTITY_DOCUMENTS, required: [IDENTITY_DOCUMENTS] }
    case "PROPERTY_OWNERSHIP": {
      const titles = category === "LAND" ? LAND_TITLES : BUILT_PROPERTY_TITLES
      return {
        accepted: [...titles, ...SUPPORTING_PROPERTY_DOCUMENTS],
        required: [titles],
      }
    }
    case "OWNER_AUTHORIZATION":
      return {
        accepted: ["MANDATE", "POWER_OF_ATTORNEY", "OTHER"],
        required: [["MANDATE", "POWER_OF_ATTORNEY"]],
      }
    case "PROPERTY_DOCUMENT":
      return {
        accepted: [...BUILT_PROPERTY_TITLES, ...SUPPORTING_PROPERTY_DOCUMENTS],
        required: [
          [...BUILT_PROPERTY_TITLES, ...SUPPORTING_PROPERTY_DOCUMENTS],
        ],
      }
    case "AGENCY":
      return {
        accepted: ["COMPANY_REGISTRATION", "PROFESSIONAL_CARD", "OTHER"],
        required: [["COMPANY_REGISTRATION", "PROFESSIONAL_CARD"]],
      }
    case "LISTING_CONSISTENCY":
      // Contrôle de l'annonce au regard des vérifications du bien : pièce facultative.
      return {
        accepted: [...BUILT_PROPERTY_TITLES, ...SUPPORTING_PROPERTY_DOCUMENTS],
        required: [],
      }
  }
}

/** Groupes obligatoires non couverts par les pièces présentes. */
export function missingDocumentGroups(
  requirement: DocumentRequirement,
  present: readonly VerificationDocumentType[],
): Array<readonly VerificationDocumentType[]> {
  return requirement.required.filter(
    (group) => !group.some((type) => present.includes(type)),
  )
}

export interface ValidityConfig {
  identityDays: number
  propertyDays: number
  agencyDays: number
  listingCheckDays: number
}

/** Échéance d'une vérification approuvée : elle devra être renouvelée. */
export function expiryFor(
  type: RequestableType,
  decidedAt: Date,
  validity: ValidityConfig,
): Date {
  const days =
    type === "IDENTITY"
      ? validity.identityDays
      : type === "AGENCY"
        ? validity.agencyDays
        : type === "LISTING_CONSISTENCY"
          ? validity.listingCheckDays
          : validity.propertyDays
  return new Date(decidedAt.getTime() + days * 86_400_000)
}
