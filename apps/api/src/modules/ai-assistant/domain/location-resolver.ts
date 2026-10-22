import { normalizeText } from "../../search/domain/text-normalizer"

/**
 * Référentiel aligné sur `prisma/seed/reference-data.ts` (Abidjan).
 * Pas de coordonnées inventées — codes uniquement.
 */
const COMMUNES: ReadonlyArray<{ code: string; aliases: string[] }> = [
  { code: "COCODY", aliases: ["cocody"] },
  { code: "MARCORY", aliases: ["marcory"] },
  { code: "YOPOUGON", aliases: ["yopougon", "yop"] },
  { code: "ABOBO", aliases: ["abobo"] },
  { code: "PLATEAU", aliases: ["plateau"] },
  { code: "TREICHVILLE", aliases: ["treichville"] },
  { code: "ADJAME", aliases: ["adjame", "adjamé"] },
  { code: "PORT_BOUET", aliases: ["port bouet", "port-bouet", "port bouët"] },
  { code: "KOUMASSI", aliases: ["koumassi"] },
  { code: "ATTECOUBE", aliases: ["attecoube", "attécoubé", "attecoubé"] },
  { code: "BINGERVILLE", aliases: ["bingerville"] },
  { code: "ANYAMA", aliases: ["anyama"] },
  { code: "SONGON", aliases: ["songon"] },
]

const NEIGHBORHOODS: ReadonlyArray<{
  code: string
  commune: string
  aliases: string[]
}> = [
  { code: "RIVIERA", commune: "COCODY", aliases: ["riviera"] },
  { code: "ANGRE", commune: "COCODY", aliases: ["angre", "angré"] },
  {
    code: "DEUX_PLATEAUX",
    commune: "COCODY",
    aliases: ["deux plateaux", "2 plateaux"],
  },
  { code: "BLOCKHAUS", commune: "COCODY", aliases: ["blockhaus"] },
  { code: "ZONE_4", commune: "MARCORY", aliases: ["zone 4", "zone4"] },
  { code: "BIETRY", commune: "MARCORY", aliases: ["bietry", "biétry"] },
  { code: "NIANGON", commune: "YOPOUGON", aliases: ["niangon"] },
]

const CITIES: ReadonlyArray<{ code: string; aliases: string[] }> = [
  { code: "ABIDJAN", aliases: ["abidjan"] },
  { code: "BOUAKE", aliases: ["bouake", "bouaké"] },
  { code: "YAMOUSSOUKRO", aliases: ["yamoussoukro", "yakro"] },
  { code: "SAN_PEDRO", aliases: ["san pedro", "san-pedro", "san pédro"] },
  { code: "GRAND_BASSAM", aliases: ["grand bassam", "bassam"] },
]

export interface ResolvedLocation {
  cities: string[]
  communes: string[]
  neighborhoods: string[]
  ambiguous: string[]
  unmatched: string[]
}

function includesAlias(haystack: string, alias: string): boolean {
  const a = normalizeText(alias)
  if (!a) return false
  return (
    haystack === a ||
    haystack.includes(` ${a} `) ||
    haystack.startsWith(`${a} `) ||
    haystack.endsWith(` ${a}`) ||
    haystack.includes(a)
  )
}

/** Résout localités à partir du texte normalisé (sans accents). */
export function resolveLocations(raw: string): ResolvedLocation {
  const text = ` ${normalizeText(raw)} `
  const cities: string[] = []
  const communes: string[] = []
  const neighborhoods: string[] = []

  for (const n of NEIGHBORHOODS) {
    if (n.aliases.some((alias) => includesAlias(text, alias))) {
      neighborhoods.push(n.code)
      if (!communes.includes(n.commune)) communes.push(n.commune)
    }
  }

  for (const c of COMMUNES) {
    if (c.aliases.some((alias) => includesAlias(text, alias))) {
      if (!communes.includes(c.code)) communes.push(c.code)
    }
  }

  for (const city of CITIES) {
    if (city.aliases.some((alias) => includesAlias(text, alias))) {
      if (!cities.includes(city.code)) cities.push(city.code)
    }
  }

  // Abidjan seul sans commune → ville seulement (clarification possible).
  return {
    cities,
    communes,
    neighborhoods,
    ambiguous: [],
    unmatched: [],
  }
}

export function knownCommuneCodes(): string[] {
  return COMMUNES.map((c) => c.code)
}
