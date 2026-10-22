import type { ListingType } from "@mon-appart/types"

import { normalizeText } from "../../search/domain/text-normalizer"
import type {
  AssistantCriteria,
  PricePeriod,
  SoftPreference,
} from "./assistant-criteria"
import { resolveLocations } from "./location-resolver"

const PROPERTY_ALIASES: ReadonlyArray<{ code: string; aliases: string[] }> = [
  { code: "APARTMENT", aliases: ["appartement", "appart", "appartements"] },
  { code: "STUDIO", aliases: ["studio", "studios"] },
  { code: "HOUSE", aliases: ["maison", "maisons"] },
  { code: "VILLA", aliases: ["villa", "villas"] },
  { code: "DUPLEX", aliases: ["duplex"] },
  { code: "LAND", aliases: ["terrain", "terrains", "parcelle"] },
  { code: "OFFICE", aliases: ["bureau", "bureaux"] },
  { code: "SHOP", aliases: ["magasin", "boutique", "local commercial"] },
]

const AMENITY_ALIASES: ReadonlyArray<{ code: string; aliases: string[] }> = [
  { code: "PARKING", aliases: ["parking", "garage", "stationnement"] },
  { code: "SWIMMING_POOL", aliases: ["piscine"] },
  { code: "SECURITY", aliases: ["gardiennage", "gardien", "securite"] },
  { code: "AIR_CONDITIONING", aliases: ["climatisation", "clim"] },
  { code: "GARDEN", aliases: ["jardin"] },
  { code: "GENERATOR", aliases: ["groupe", "groupe electrogene"] },
  { code: "FURNISHED", aliases: ["meuble", "meublé"] },
  { code: "WIFI", aliases: ["wifi", "wi-fi", "internet"] },
  { code: "BALCONY", aliases: ["balcon"] },
  { code: "ELEVATOR", aliases: ["ascenseur"] },
]

function emptyCriteria(): AssistantCriteria {
  return {
    listingTypes: [],
    propertyTypes: [],
    communes: [],
    neighborhoods: [],
    cities: [],
    priceMin: null,
    priceMax: null,
    currency: "XOF",
    pricePeriod: "UNKNOWN",
    bedroomsMin: null,
    bathroomsMin: null,
    surfaceMin: null,
    surfaceMax: null,
    amenities: [],
    softPreferences: [],
    unverifiableHints: [],
    missing: [],
    clarificationQuestion: null,
    freeText: null,
    acceptSearchWithoutBudget: false,
    acceptCityWide: false,
    confidence: 0,
  }
}

function extractListingTypes(text: string): ListingType[] {
  const types: ListingType[] = []
  if (
    /\b(acheter|achat|vente|a vendre|à vendre|investir)\b/.test(text) ||
    /\bprix d.?achat\b/.test(text)
  ) {
    types.push("SALE")
  }
  if (
    /\b(louer|location|loyer|a louer|à louer|mensuel)\b/.test(text) ||
    /\bpar mois\b/.test(text)
  ) {
    types.push("RENT")
  }
  if (
    /\b(courte duree|court sejour|journalier|par jour|airbnb|nuit[eé]e)\b/.test(
      text,
    )
  ) {
    types.push("SHORT_TERM_RENT")
  }
  return [...new Set(types)]
}

function extractPropertyTypes(text: string): string[] {
  const found: string[] = []
  for (const entry of PROPERTY_ALIASES) {
    if (entry.aliases.some((a) => text.includes(normalizeText(a)))) {
      found.push(entry.code)
    }
  }
  return found
}

function extractAmenities(text: string): string[] {
  const found: string[] = []
  for (const entry of AMENITY_ALIASES) {
    if (entry.aliases.some((a) => text.includes(normalizeText(a)))) {
      found.push(entry.code)
    }
  }
  return found
}

function extractSoft(text: string): {
  soft: SoftPreference[]
  hints: string[]
} {
  const soft: SoftPreference[] = []
  const hints: string[] = []
  if (/\b(calme|tranquille|paisible)\b/.test(text)) {
    soft.push("CALM_AREA")
    hints.push(
      "La préférence « quartier calme » n’est pas un filtre strict : elle n’est pas vérifiée automatiquement.",
    )
  }
  if (
    /\b(rapidement|urgent|immediat|immédiat|emménager vite|disponible vite)\b/.test(
      text,
    )
  ) {
    soft.push("QUICK_MOVE_IN")
    hints.push(
      "La disponibilité « rapide » dépend de ce que l’annonceur a déclaré ; elle n’est pas garantie.",
    )
  }
  if (/\b(familial|famille|enfants)\b/.test(text)) {
    soft.push("FAMILY")
  }
  if (/\b(commerce|commerces|marche|marché)\b/.test(text)) {
    soft.push("NEAR_SHOPS")
    hints.push(
      "« Proche des commerces » n’est pas un filtre géographique fiable sans données dédiées.",
    )
  }
  if (/\b(exterieur|extérieur|jardin|cour|terrasse)\b/.test(text)) {
    soft.push("OUTDOOR_SPACE")
  }
  return { soft, hints }
}

/**
 * Budgets FR/CI : « 250 000 », « 250000 », « 250k », « 1.5M », « max 300000 ».
 */
export function extractBudget(text: string): {
  min: number | null
  max: number | null
  period: PricePeriod
} {
  let period: PricePeriod = "UNKNOWN"
  if (/\b(par mois|\/\s*mois|mensuel|loyer)\b/.test(text)) period = "MONTH"
  else if (/\b(par jour|\/\s*jour|journalier|nuit)\b/.test(text)) period = "DAY"
  else if (/\b(achat|prix total|cash|comptant)\b/.test(text)) period = "TOTAL"

  const amounts: number[] = []
  const patterns = [
    /(\d{1,3}(?:[ \u00a0.]\d{3})+|\d+)\s*(?:f\s*cfa|fcfa|xof|francs?)?/gi,
    /(\d+(?:[.,]\d+)?)\s*[kK]\b/g,
    /(\d+(?:[.,]\d+)?)\s*[mM]\b/g,
  ]

  for (const match of text.matchAll(patterns[0]!)) {
    const raw = match[1]!.replace(/[ \u00a0.]/g, "")
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 10_000) amounts.push(n)
  }
  for (const match of text.matchAll(patterns[1]!)) {
    const n = Number.parseFloat(match[1]!.replace(",", ".")) * 1_000
    if (Number.isFinite(n) && n >= 10_000) amounts.push(Math.round(n))
  }
  for (const match of text.matchAll(patterns[2]!)) {
    const n = Number.parseFloat(match[1]!.replace(",", ".")) * 1_000_000
    if (Number.isFinite(n) && n >= 10_000) amounts.push(Math.round(n))
  }

  const unique = [...new Set(amounts)].sort((a, b) => a - b)
  if (unique.length === 0) return { min: null, max: null, period }

  const hasMax =
    /\b(maximum|max|jusqu.?a|jusqu.?à|moins de|pas plus|budget de)\b/.test(text)
  const hasMin = /\b(minimum|min|a partir|à partir|au moins)\b/.test(text)

  if (unique.length >= 2) {
    return { min: unique[0]!, max: unique[unique.length - 1]!, period }
  }

  const only = unique[0]!
  if (hasMin && !hasMax) return { min: only, max: null, period }
  return { min: null, max: only, period }
}

function extractRooms(text: string): {
  bedrooms: number | null
  bathrooms: number | null
} {
  let bedrooms: number | null = null
  let bathrooms: number | null = null

  const bed =
    text.match(
      /(\d+)\s*(?:chambres?|ch\.?|pieces?|pièces?)\b/,
    ) ?? text.match(/\b(\d+)\s*ch\b/)
  if (bed) {
    const n = Number.parseInt(bed[1]!, 10)
    if (n >= 1 && n <= 20) bedrooms = n
  }

  const bath = text.match(/(\d+)\s*(?:sdb|salles? de bains?|salles? d.?eau)\b/)
  if (bath) {
    const n = Number.parseInt(bath[1]!, 10)
    if (n >= 1 && n <= 20) bathrooms = n
  }

  return { bedrooms, bathrooms }
}

function extractSurface(text: string): {
  min: number | null
  max: number | null
} {
  const m = text.match(/(\d+)\s*(?:m2|m²|metres? carres?|mètres? carrés?)\b/)
  if (!m) return { min: null, max: null }
  const n = Number.parseInt(m[1]!, 10)
  if (!Number.isFinite(n) || n < 10 || n > 50_000) return { min: null, max: null }
  if (/\b(minimum|au moins|a partir|à partir)\b/.test(text)) {
    return { min: n, max: null }
  }
  return { min: n, max: n }
}

function buildClarification(c: AssistantCriteria): string | null {
  if (c.listingTypes.length === 0 && c.propertyTypes.includes("LAND")) {
    return "Souhaitez-vous acheter un terrain ou en louer un ?"
  }
  if (c.listingTypes.length === 0) {
    return "Vous cherchez à louer ou à acheter ?"
  }
  if (
    c.cities.includes("ABIDJAN") &&
    c.communes.length === 0 &&
    c.neighborhoods.length === 0 &&
    !c.acceptCityWide
  ) {
    return "Quelle commune ou quel quartier d’Abidjan préférez-vous (ex. Cocody, Yopougon) ? Vous pouvez aussi lancer la recherche sur tout Abidjan."
  }
  if (
    c.priceMax == null &&
    c.priceMin == null &&
    c.listingTypes.includes("RENT") &&
    !c.acceptSearchWithoutBudget
  ) {
    return "Quel budget mensuel maximum (en F CFA) souhaitez-vous ? Vous pouvez aussi lancer la recherche sans budget."
  }
  if (c.pricePeriod === "UNKNOWN" && (c.priceMax != null || c.priceMin != null)) {
    if (c.listingTypes.includes("RENT") && !c.listingTypes.includes("SALE")) {
      return null // déduit MONTH plus bas
    }
    return "Ce budget est-il un loyer mensuel, un tarif journalier ou un prix d’achat total ?"
  }
  return null
}

function finalizeMissing(c: AssistantCriteria): AssistantCriteria["missing"] {
  const missing: AssistantCriteria["missing"] = []
  if (c.listingTypes.length === 0) missing.push("listingType")
  return missing
}

function applyExplicitOverrides(c: AssistantCriteria, text: string): void {
  if (/\bsans budget\b/.test(text) || /\bpas de budget\b/.test(text)) {
    c.priceMin = null
    c.priceMax = null
    c.pricePeriod = "UNKNOWN"
    c.acceptSearchWithoutBudget = true
  }
  if (
    /\btout abidjan\b/.test(text) ||
    /\bsans commune\b/.test(text) ||
    /\blancer (la )?recherche\b/.test(text)
  ) {
    if (/\btout abidjan\b/.test(text) || /\bsans commune\b/.test(text)) {
      c.communes = []
      c.neighborhoods = []
      if (!c.cities.includes("ABIDJAN")) c.cities = ["ABIDJAN"]
      c.acceptCityWide = true
    }
    if (/\blancer (la )?recherche\b/.test(text)) {
      c.acceptSearchWithoutBudget = true
      c.acceptCityWide = true
    }
  }
}

function scoreConfidence(c: AssistantCriteria): number {
  let score = 0.2
  if (c.listingTypes.length) score += 0.25
  if (c.propertyTypes.length) score += 0.15
  if (c.communes.length || c.neighborhoods.length) score += 0.2
  else if (c.cities.length) score += 0.1
  if (c.priceMax != null || c.priceMin != null) score += 0.15
  if (c.bedroomsMin != null) score += 0.05
  return Math.min(1, Math.round(score * 100) / 100)
}

/**
 * Extraction déterministe FR/CI — source de vérité des critères avant Search.
 * Aucune invention d’annonce ni de localité hors référentiel.
 */
export function extractCriteria(message: string): AssistantCriteria {
  const criteria = emptyCriteria()
  const text = normalizeText(message)
  if (!text) {
    criteria.missing = ["listingType", "location"]
    criteria.clarificationQuestion =
      "Que recherchez-vous : location ou achat, et dans quelle zone ?"
    return criteria
  }

  criteria.listingTypes = extractListingTypes(text)
  criteria.propertyTypes = extractPropertyTypes(text)
  const loc = resolveLocations(message)
  criteria.cities = loc.cities
  criteria.communes = loc.communes
  criteria.neighborhoods = loc.neighborhoods

  const budget = extractBudget(text)
  criteria.priceMin = budget.min
  criteria.priceMax = budget.max
  criteria.pricePeriod = budget.period

  if (
    criteria.pricePeriod === "UNKNOWN" &&
    (criteria.priceMax != null || criteria.priceMin != null)
  ) {
    if (
      criteria.listingTypes.includes("RENT") &&
      !criteria.listingTypes.includes("SALE")
    ) {
      criteria.pricePeriod = "MONTH"
    } else if (
      criteria.listingTypes.includes("SALE") &&
      !criteria.listingTypes.includes("RENT")
    ) {
      criteria.pricePeriod = "TOTAL"
    } else if (criteria.listingTypes.includes("SHORT_TERM_RENT")) {
      criteria.pricePeriod = "DAY"
    }
  }

  const rooms = extractRooms(text)
  criteria.bedroomsMin = rooms.bedrooms
  criteria.bathroomsMin = rooms.bathrooms

  const surface = extractSurface(text)
  criteria.surfaceMin = surface.min
  criteria.surfaceMax = surface.max

  criteria.amenities = extractAmenities(text)
  const soft = extractSoft(text)
  criteria.softPreferences = soft.soft
  criteria.unverifiableHints = soft.hints

  applyExplicitOverrides(criteria, text)

  // Terrain + louer/acheter déjà géré ; si « terrain » seul → clarification.
  if (
    criteria.propertyTypes.includes("LAND") &&
    criteria.listingTypes.length === 0
  ) {
    criteria.clarificationQuestion =
      "Souhaitez-vous acheter un terrain ou en louer un ?"
  } else {
    criteria.clarificationQuestion = buildClarification(criteria)
  }

  criteria.missing = finalizeMissing(criteria)
  criteria.confidence = scoreConfidence(criteria)

  // Texte libre résiduel : si peu de structure, garder un extrait court pour `q`.
  if (
    criteria.propertyTypes.length === 0 &&
    criteria.communes.length === 0 &&
    criteria.neighborhoods.length === 0
  ) {
    criteria.freeText = text.slice(0, 120)
  }

  return criteria
}

/** Fusionne un message de suivi avec les critères déjà confirmés. */
export function mergeCriteria(
  previous: AssistantCriteria,
  nextMessage: string,
): AssistantCriteria {
  const next = extractCriteria(nextMessage)
  const merged: AssistantCriteria = {
    ...previous,
    listingTypes: next.listingTypes.length
      ? next.listingTypes
      : previous.listingTypes,
    propertyTypes: next.propertyTypes.length
      ? next.propertyTypes
      : previous.propertyTypes,
    communes: next.communes.length ? next.communes : previous.communes,
    neighborhoods: next.neighborhoods.length
      ? next.neighborhoods
      : previous.neighborhoods,
    cities: next.cities.length ? next.cities : previous.cities,
    priceMin: next.priceMin ?? previous.priceMin,
    priceMax: next.priceMax ?? previous.priceMax,
    pricePeriod:
      next.pricePeriod !== "UNKNOWN" ? next.pricePeriod : previous.pricePeriod,
    bedroomsMin: next.bedroomsMin ?? previous.bedroomsMin,
    bathroomsMin: next.bathroomsMin ?? previous.bathroomsMin,
    surfaceMin: next.surfaceMin ?? previous.surfaceMin,
    surfaceMax: next.surfaceMax ?? previous.surfaceMax,
    amenities: [...new Set([...previous.amenities, ...next.amenities])],
    softPreferences: [
      ...new Set([...previous.softPreferences, ...next.softPreferences]),
    ],
    unverifiableHints: [
      ...new Set([...previous.unverifiableHints, ...next.unverifiableHints]),
    ],
    freeText: next.freeText ?? previous.freeText,
    acceptSearchWithoutBudget:
      previous.acceptSearchWithoutBudget || next.acceptSearchWithoutBudget,
    acceptCityWide: previous.acceptCityWide || next.acceptCityWide,
    clarificationQuestion: null,
    missing: [],
    confidence: 0,
  }

  applyExplicitOverrides(merged, normalizeText(nextMessage))

  merged.clarificationQuestion = buildClarification(merged)
  merged.missing = finalizeMissing(merged)
  merged.confidence = scoreConfidence(merged)
  return merged
}
