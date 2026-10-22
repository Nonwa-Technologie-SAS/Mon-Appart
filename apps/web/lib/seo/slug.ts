const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Normalise un libellé en slug URL (ASCII, tirets, sans accents). */
export function slugify(input: string, maxLength = 80): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "")
  return normalized || "annonce"
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Segment d'URL d'annonce : `{slug}--{uuid}`.
 * L'identifiant public (UUID) résout l'annonce ; le slug est cosmétique et peut changer.
 */
export function listingSegment(title: string, id: string): string {
  return `${slugify(title)}--${id}`
}

export function parseListingSegment(
  segment: string,
): { slug: string; id: string } | null {
  const sep = segment.lastIndexOf("--")
  if (sep <= 0) return null
  const slug = segment.slice(0, sep)
  const id = segment.slice(sep + 2)
  if (!slug || !isUuid(id)) return null
  return { slug, id }
}

export function locationSlug(location: string): string {
  return slugify(location, 64)
}
