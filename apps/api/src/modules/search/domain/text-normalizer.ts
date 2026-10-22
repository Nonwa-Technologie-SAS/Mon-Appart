/** Longueur maximale du texte libre accepté, après normalisation. */
export const MAX_QUERY_LENGTH = 120
/** Au-delà, les mots suivants sont ignorés (borne le coût du tsquery). */
export const MAX_QUERY_TOKENS = 8

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g
const DIACRITICS = /\p{M}/gu

/** Minuscules, sans accents ni caractères de contrôle, espaces compactés. */
export function normalizeText(value: string): string {
  return value
    .replace(CONTROL_CHARS, " ")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Mots indexables : lettres et chiffres ASCII uniquement. Tout autre caractère
 * (opérateurs tsquery `& | ! : ( )`, guillemets, SQL) devient un séparateur.
 * Les mots d'une lettre (« à » devient « a ») sont ignorés.
 */
export function tokenize(normalized: string): string[] {
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
  return [...new Set(tokens)].slice(0, MAX_QUERY_TOKENS)
}

/** Code de référentiel depuis une saisie libre : « Port-Bouët » → `PORT_BOUET`. */
export function normalizeCode(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
}

export type SynonymMap = ReadonlyMap<string, readonly string[]>

/**
 * `SEARCH_SYNONYMS` : `commerce=magasin|boutique;bureau=office`. Les termes
 * sont normalisés ; une entrée invalide est ignorée.
 */
export function parseSynonyms(raw: string): SynonymMap {
  const map = new Map<string, string[]>()
  for (const entry of raw.split(";")) {
    const [term, alternatives] = entry.split("=")
    if (!term || !alternatives) continue
    const key = tokenize(normalizeText(term))[0]
    if (!key) continue
    const values = alternatives
      .split("|")
      .flatMap((alt) => tokenize(normalizeText(alt)).slice(0, 1))
      .filter((alt) => alt !== key)
    if (values.length > 0) map.set(key, [...new Set(values)])
  }
  return map
}

/**
 * Expression `to_tsquery` construite uniquement à partir de mots
 * `[a-z0-9]+` : chaque mot devient un préfixe, les synonymes un OU.
 * Le résultat est toujours passé en paramètre lié, jamais concaténé au SQL.
 */
export function buildTsQuery(
  tokens: readonly string[],
  synonyms: SynonymMap,
): string | null {
  if (tokens.length === 0) return null
  return tokens
    .map((token) => {
      const terms = [token, ...(synonyms.get(token) ?? [])].map(
        (term) => `${term}:*`,
      )
      return terms.length === 1 ? terms[0] : `(${terms.join(" | ")})`
    })
    .join(" & ")
}
