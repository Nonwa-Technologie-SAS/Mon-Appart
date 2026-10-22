import { notFound, permanentRedirect } from "next/navigation"

import { getAvailablePropertyById } from "@/lib/properties"
import { isUuid, listingPath } from "@/lib/seo"
import { PropertyStatus } from "@/lib/domain-enums"

/**
 * Ancienne URL `/biens/:id` → redirection permanente vers
 * `/annonces/{slug}--{id}` (URL canonique).
 */
export default async function LegacyPropertyRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const property = await getAvailablePropertyById(id)
  if (!property) notFound()

  if (property.status !== PropertyStatus.AVAILABLE) {
    // Propriétaire : la fiche publique n'est plus indexable ; 404 pour les
    // anciens liens publics évite de servir du contenu retiré.
    notFound()
  }

  permanentRedirect(listingPath(property.title, property.id))
}
