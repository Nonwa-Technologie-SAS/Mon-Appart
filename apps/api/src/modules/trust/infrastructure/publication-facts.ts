import type { Db } from "../../../database/database.service"
import type { OwnershipType } from "../../../generated/prisma/enums"
import { holdsClaimedRelation, type VerificationFact } from "../domain/badges"
import type { PublicationFacts } from "../domain/publication-requirements"
import { isValidVerification } from "../domain/verification-status"

const factSelect = {
  type: true,
  status: true,
  userId: true,
  propertyId: true,
  listingId: true,
  claimedRelation: true,
  verifiedAt: true,
  decidedAt: true,
  expiresAt: true,
} as const

/** Identité vérifiée et valide (approuvée, non échue). */
export async function hasValidIdentity(
  db: Db,
  userId: bigint,
  now: Date,
): Promise<boolean> {
  const rows = await db.verification.findMany({
    where: { userId, type: "IDENTITY", status: "VERIFIED" },
    select: { status: true, expiresAt: true },
  })
  return rows.some((row) => isValidVerification(row, now))
}

/**
 * Droit de publier le bien : propriété ou mandat approuvé, valide, et dont le
 * déclarant détient toujours le rattachement revendiqué.
 */
export async function hasPublicationRight(
  db: Db,
  propertyId: bigint,
  now: Date,
): Promise<boolean> {
  const [facts, ownerships] = await Promise.all([
    db.verification.findMany({
      where: {
        propertyId,
        status: "VERIFIED",
        type: { in: ["PROPERTY_OWNERSHIP", "OWNER_AUTHORIZATION"] },
      },
      select: factSelect,
    }),
    db.propertyOwnership.findMany({
      where: { propertyId, isCurrent: true },
      select: { ownerId: true, ownershipType: true },
    }),
  ])
  const relations = new Map<bigint, OwnershipType[]>()
  for (const row of ownerships) {
    relations.set(row.ownerId, [
      ...(relations.get(row.ownerId) ?? []),
      row.ownershipType,
    ])
  }
  return facts.some(
    (fact: VerificationFact) =>
      isValidVerification(fact, now) && holdsClaimedRelation(fact, relations),
  )
}

/** Faits lus par Listing avant publication (`LISTING_PUBLICATION_REQUIREMENTS`). */
export async function loadPublicationFacts(
  db: Db,
  input: { publisherId: bigint; propertyId: bigint },
  now: Date,
): Promise<PublicationFacts> {
  const [publisherIdentityVerified, publicationRightVerified] =
    await Promise.all([
      hasValidIdentity(db, input.publisherId, now),
      hasPublicationRight(db, input.propertyId, now),
    ])
  return { publisherIdentityVerified, publicationRightVerified }
}
