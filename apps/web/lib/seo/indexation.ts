/**
 * Politique d'indexation des URL de recherche / filtres.
 *
 * Indexable :
 * - pages catalogue `/locations`, `/appartements-a-louer`, …
 * - pages `/location/{slug}` avec au moins une annonce AVAILABLE
 * - fiches `/annonces/{slug}--{id}` AVAILABLE
 * - pages éditoriales `/`, `/a-propos`, `/guides/…`
 *
 * Non indexable :
 * - `/?…` avec filtres (q, type, maxPrice, lat, lng) → noindex, follow
 * - pagination / tri combinés hors pages catalogue
 * - `/connexion`, `/inscription`, `/espace`, `/admin`
 * - annonces non AVAILABLE pour le public
 */

export type SearchIndexDecision = {
  index: boolean
  /** Chemin canonique préféré lorsque le filtre correspond à une page catalogue. */
  canonicalPath: string
  reason: string
}

const TYPE_TO_PATH: Record<string, string> = {
  APARTMENT: "/appartements-a-louer",
  HOUSE: "/maisons-a-louer",
  STUDIO: "/studios-a-louer",
  VILLA: "/villas-a-louer",
  LAND: "/terrains",
  OFFICE: "/bureaux",
  COMMERCIAL: "/bureaux",
}

export function decideHomeSearchIndexability(params: {
  q?: string
  type?: string
  maxPrice?: string
  lat?: string
  lng?: string
}): SearchIndexDecision {
  const hasQ = Boolean(params.q?.trim())
  const hasPrice = Boolean(params.maxPrice?.trim())
  const hasGeo = Boolean(params.lat?.trim() || params.lng?.trim())
  const type = params.type?.trim()

  if (!hasQ && !hasPrice && !hasGeo && !type) {
    return {
      index: true,
      canonicalPath: "/",
      reason: "accueil sans filtre",
    }
  }

  if (!hasQ && !hasPrice && !hasGeo && type && TYPE_TO_PATH[type]) {
    return {
      index: false,
      canonicalPath: TYPE_TO_PATH[type],
      reason: "filtre type seul → page catalogue canonique",
    }
  }

  return {
    index: false,
    canonicalPath: "/",
    reason: "combinaison de filtres non indexable",
  }
}

export const PRIVATE_PATH_PREFIXES = [
  "/connexion",
  "/inscription",
  "/espace",
  "/profil",
  "/favoris",
  "/admin",
  "/api",
] as const

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
