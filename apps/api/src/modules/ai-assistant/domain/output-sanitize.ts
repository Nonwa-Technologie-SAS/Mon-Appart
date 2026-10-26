/**
 * Contrôles déterministes sur les sorties LLM et signaux d’injection.
 * Les messages utilisateur et descriptions d’annonces sont non fiables.
 */

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all|previous|prior|above)\s+instructions/i,
  /disregard\s+(the\s+)?(system|previous)/i,
  /you\s+are\s+now\b/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /exfiltrat/i,
  /dump\s+(the\s+)?(database|users|secrets)/i,
  /oublie\s+(tes|les)\s+instructions/i,
  /affiche\s+(le|ton)\s+prompt/i,
]

export function looksLikePromptInjection(text: string): boolean {
  const sample = text.slice(0, 4_000)
  return INJECTION_PATTERNS.some((pattern) => pattern.test(sample))
}

/**
 * Retire les UUID absents du catalogue Search de ce tour.
 * Si le texte devient trop court, on revient au message déterministe.
 */
export function sanitizeAssistantReply(
  content: string,
  allowedListingIds: ReadonlySet<string>,
  fallback: string,
): string {
  let out = content
  for (const match of content.matchAll(UUID_RE)) {
    const id = match[0]!
    if (!allowedListingIds.has(id)) {
      out = out.replaceAll(id, "")
    }
  }
  const cleaned = out.replace(/\s{2,}/g, " ").trim()
  return cleaned.length > 20 ? cleaned : fallback
}

const PRIVATE_PATTERNS: readonly RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+225)?\s*\d{2}(?:[\s.-]?\d{2}){3,4}\b/,
  /bearer\s+[a-z0-9._-]+/i,
]

export function containsPrivateData(text: string): boolean {
  return PRIVATE_PATTERNS.some((pattern) => pattern.test(text))
}
