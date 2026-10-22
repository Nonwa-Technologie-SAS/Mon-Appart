import type {
  OwnershipType,
  VerificationStatus,
  VerificationType,
} from "../../../generated/prisma/enums"
import { isValidVerification } from "./verification-status"

export const BadgeCode = {
  PHONE_VERIFIED: "PHONE_VERIFIED",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  IDENTITY_VERIFIED: "IDENTITY_VERIFIED",
  AGENCY_VERIFIED: "AGENCY_VERIFIED",
  PUBLICATION_RIGHT_VERIFIED: "PUBLICATION_RIGHT_VERIFIED",
  PROPERTY_DOCUMENTS_REVIEWED: "PROPERTY_DOCUMENTS_REVIEWED",
  LISTING_CHECKED: "LISTING_CHECKED",
} as const

export type BadgeCode = (typeof BadgeCode)[keyof typeof BadgeCode]

/**
 * Libellés factuels : ce qui a été examiné, jamais une garantie (pas de
 * « propriétaire garanti » ni de « bien sans risque »).
 */
export const BADGE_LABELS: Record<BadgeCode, string> = {
  PHONE_VERIFIED: "Téléphone vérifié",
  EMAIL_VERIFIED: "E-mail vérifié",
  IDENTITY_VERIFIED: "Identité vérifiée",
  AGENCY_VERIFIED: "Agence vérifiée",
  PUBLICATION_RIGHT_VERIFIED: "Droit de publication vérifié",
  PROPERTY_DOCUMENTS_REVIEWED: "Documents du bien examinés",
  LISTING_CHECKED: "Annonce contrôlée",
}

export const BADGE_DISCLAIMER =
  "Ces indications résultent d'un examen des pièces fournies, à la date " +
  "indiquée. Elles ne constituent ni une certification juridique du titre " +
  "de propriété, ni une garantie sur le bien ou la transaction. Visitez le " +
  "bien et vérifiez les documents avant tout paiement."

export interface Badge {
  code: BadgeCode
  label: string
  verifiedAt: Date
  expiresAt: Date | null
}

export interface VerificationFact {
  type: VerificationType
  status: VerificationStatus
  userId: bigint
  propertyId: bigint | null
  listingId: bigint | null
  claimedRelation: OwnershipType | null
  verifiedAt: Date | null
  decidedAt: Date | null
  expiresAt: Date | null
}

export interface UserBadgeFacts {
  phoneVerifiedAt: Date | null
  emailVerifiedAt: Date | null
  verifications: readonly VerificationFact[]
}

/** Rattachements courants au bien, par utilisateur (property_ownerships non clôturés). */
export type CurrentRelations = ReadonlyMap<bigint, readonly OwnershipType[]>

export interface ListingBadgeFacts {
  listingId: bigint
  propertyId: bigint
  /** Début de validité du prix courant : un contrôle antérieur n'est plus probant. */
  currentPriceSince: Date | null
  /** Vérifications du bien et de l'annonce (tous déclarants). */
  verifications: readonly VerificationFact[]
  relations: CurrentRelations
}

function badge(code: BadgeCode, fact: VerificationFact): Badge | null {
  const verifiedAt = fact.verifiedAt ?? fact.decidedAt
  if (!verifiedAt) return null
  return {
    code,
    label: BADGE_LABELS[code],
    verifiedAt,
    expiresAt: fact.expiresAt,
  }
}

/** Dernière vérification valide d'un type parmi les faits. */
function latestValid(
  facts: readonly VerificationFact[],
  now: Date,
  accept: (fact: VerificationFact) => boolean,
): VerificationFact | null {
  let best: VerificationFact | null = null
  for (const fact of facts) {
    if (!accept(fact) || !isValidVerification(fact, now)) continue
    const at = fact.verifiedAt ?? fact.decidedAt
    const bestAt = best ? (best.verifiedAt ?? best.decidedAt) : null
    if (at && (!bestAt || at > bestAt)) best = fact
  }
  return best
}

export function userBadges(facts: UserBadgeFacts, now: Date): Badge[] {
  const badges: Badge[] = []
  if (facts.phoneVerifiedAt) {
    badges.push({
      code: "PHONE_VERIFIED",
      label: BADGE_LABELS.PHONE_VERIFIED,
      verifiedAt: facts.phoneVerifiedAt,
      expiresAt: null,
    })
  }
  if (facts.emailVerifiedAt) {
    badges.push({
      code: "EMAIL_VERIFIED",
      label: BADGE_LABELS.EMAIL_VERIFIED,
      verifiedAt: facts.emailVerifiedAt,
      expiresAt: null,
    })
  }
  for (const [type, code] of [
    ["IDENTITY", "IDENTITY_VERIFIED"],
    ["AGENCY", "AGENCY_VERIFIED"],
  ] as const) {
    const fact = latestValid(facts.verifications, now, (f) => f.type === type)
    const granted = fact ? badge(code, fact) : null
    if (granted) badges.push(granted)
  }
  return badges
}

/**
 * Le droit de publier n'est reconnu que si le déclarant détient toujours le
 * rattachement revendiqué : un mandat retiré efface le badge sans attendre
 * une révocation.
 */
export function holdsClaimedRelation(
  fact: VerificationFact,
  relations: CurrentRelations,
): boolean {
  if (!fact.claimedRelation) return false
  return (relations.get(fact.userId) ?? []).includes(fact.claimedRelation)
}

export function listingBadges(facts: ListingBadgeFacts, now: Date): Badge[] {
  const badges: Badge[] = []
  const onProperty = facts.verifications.filter(
    (fact) => fact.propertyId === facts.propertyId,
  )
  const right = latestValid(
    onProperty,
    now,
    (fact) =>
      (fact.type === "PROPERTY_OWNERSHIP" ||
        fact.type === "OWNER_AUTHORIZATION") &&
      holdsClaimedRelation(fact, facts.relations),
  )
  const rightBadge = right ? badge("PUBLICATION_RIGHT_VERIFIED", right) : null
  if (rightBadge) badges.push(rightBadge)

  const documents = latestValid(
    onProperty,
    now,
    (fact) => fact.type === "PROPERTY_DOCUMENT",
  )
  const documentsBadge = documents
    ? badge("PROPERTY_DOCUMENTS_REVIEWED", documents)
    : null
  if (documentsBadge) badges.push(documentsBadge)

  const check = latestValid(
    onProperty,
    now,
    (fact) =>
      fact.type === "LISTING_CONSISTENCY" &&
      fact.listingId === facts.listingId &&
      // Un prix modifié après le contrôle invalide le contrôle.
      (facts.currentPriceSince === null ||
        (fact.decidedAt !== null && fact.decidedAt >= facts.currentPriceSince)),
  )
  const checkBadge = check ? badge("LISTING_CHECKED", check) : null
  if (checkBadge) badges.push(checkBadge)
  return badges
}
