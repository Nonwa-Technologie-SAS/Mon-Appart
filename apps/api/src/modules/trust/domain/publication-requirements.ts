/**
 * Exigences de vérification avant publication d'une annonce
 * (`LISTING_PUBLICATION_REQUIREMENTS`). Fonction pure : Listing fournit les
 * faits, sans dépendre du module Trust.
 */
export const PublicationRequirement = {
  /** Identité du publiant vérifiée et valide. */
  IDENTITY: "IDENTITY",
  /** Propriété ou mandat vérifié, valide, détenu par un gestionnaire courant du bien. */
  PUBLICATION_RIGHT: "PUBLICATION_RIGHT",
} as const

export type PublicationRequirement =
  (typeof PublicationRequirement)[keyof typeof PublicationRequirement]

export function parsePublicationRequirements(
  raw: string | undefined | null,
): PublicationRequirement[] {
  const allowed = Object.values(PublicationRequirement) as string[]
  return [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item): item is PublicationRequirement =>
          allowed.includes(item),
        ),
    ),
  ]
}

export interface PublicationFacts {
  publisherIdentityVerified: boolean
  publicationRightVerified: boolean
}

export function missingPublicationRequirements(
  required: readonly PublicationRequirement[],
  facts: PublicationFacts,
): PublicationRequirement[] {
  return required.filter((requirement) =>
    requirement === "IDENTITY"
      ? !facts.publisherIdentityVerified
      : !facts.publicationRightVerified,
  )
}
