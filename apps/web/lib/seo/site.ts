/**
 * URL canonique du site public. Ne jamais inventer un domaine de production :
 * configurer `NEXT_PUBLIC_SITE_URL` (ou `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`).
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000"
  return raw.replace(/\/+$/, "")
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl()
  if (!path || path === "/") return base
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

/** Hors production : les robots doivent refuser l'indexation. */
export function isIndexableEnvironment(): boolean {
  if (process.env.NEXT_PUBLIC_SEO_INDEXING === "true") return true
  if (process.env.NEXT_PUBLIC_SEO_INDEXING === "false") return false
  return process.env.NODE_ENV === "production"
}

export const SITE_NAME = "Mon Appart"
export const DEFAULT_DESCRIPTION =
  "Recherchez, découvrez et louez un logement en Côte d’Ivoire. Annonces avec photos, localisation et demande de visite."
