/**
 * Normalise le pathname Next.js vers une route catalogue analytics
 * (pas d’UUID, pas de query, pas de segments numériques longs).
 */

const LISTING_SEGMENT = /^\/annonces\/[^/]+$/i
const LOCATION_SEGMENT = /^\/location\/[^/]+$/i
const BIENS_SEGMENT = /^\/biens\/[^/]+$/i

export function normalizeAnalyticsRoute(pathname: string): string {
  const path = (pathname.split("?")[0] ?? "/").replace(/\/+$/, "") || "/"

  if (LISTING_SEGMENT.test(path) || BIENS_SEGMENT.test(path)) {
    return "/annonces/[id]"
  }
  if (LOCATION_SEGMENT.test(path)) {
    return "/location/[slug]"
  }
  if (path.startsWith("/espace")) return "/espace"
  if (path.startsWith("/profil")) return "/profil"
  if (path.startsWith("/favoris")) return "/favoris"
  if (path.startsWith("/connexion")) return "/connexion"
  if (path.startsWith("/inscription")) return "/inscription"

  // Segments alphabétiques courts uniquement (catalogues SEO).
  if (/^\/[a-z0-9\-/]*$/i.test(path) && !/\d{3,}/.test(path)) {
    return path.toLowerCase().slice(0, 120)
  }
  return "/other"
}
