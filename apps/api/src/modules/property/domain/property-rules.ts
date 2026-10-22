import type {
  PropertyCategory,
  PropertyStatus,
} from "../../../generated/prisma/enums"
import { propertyError, PropertyErrorCode } from "./property-errors"

/** Caractéristiques du bien utiles aux règles métier, en unités simples. */
export interface PropertyCharacteristics {
  category: PropertyCategory
  title: string
  surface: number | null
  landSurface: number | null
  bedrooms: number | null
  bathrooms: number | null
  rooms: number | null
  floor: number | null
  totalFloors: number | null
  latitude: number | null
  longitude: number | null
  attributes: Record<string, unknown>
}

/**
 * Emprise large de la Côte d'Ivoire (avec marge). Contrôle volontairement
 * souple : il écarte les inversions latitude/longitude et les points hors
 * pays, sans prétendre vérifier le quartier.
 */
export const COTE_DIVOIRE_BOUNDS = {
  minLatitude: 4.2,
  maxLatitude: 10.8,
  minLongitude: -8.7,
  maxLongitude: -2.4,
} as const

type AttributeKind =
  "boolean" | "integer" | "number" | { oneOf: readonly string[] }

const RESIDENTIAL_ATTRIBUTES: Record<string, AttributeKind> = {
  parkingSpaces: "integer",
  servantQuarters: "boolean",
  standing: { oneOf: ["ECONOMIQUE", "MOYEN", "HAUT"] },
  waterMeter: "boolean",
  electricityMeter: "boolean",
}

const LAND_ATTRIBUTES: Record<string, AttributeKind> = {
  serviced: "boolean",
  fenced: "boolean",
  buildable: "boolean",
  frontageMeters: "number",
  // Déclaratif : la vérification juridique n'est pas couverte par ce module.
  landTitle: {
    oneOf: [
      "ACD",
      "CPF",
      "LETTRE_ATTRIBUTION",
      "ATTESTATION_VILLAGEOISE",
      "AUTRE",
    ],
  },
}

const COMMERCIAL_ATTRIBUTES: Record<string, AttributeKind> = {
  parkingSpaces: "integer",
  frontageMeters: "number",
  storefront: "boolean",
}

const INDUSTRIAL_ATTRIBUTES: Record<string, AttributeKind> = {
  ceilingHeightMeters: "number",
  loadingDocks: "integer",
  threePhasePower: "boolean",
}

/** Clés JSONB autorisées par catégorie. Tout champ filtré reste une colonne. */
export const ATTRIBUTE_SPECS: Record<
  PropertyCategory,
  Record<string, AttributeKind>
> = {
  RESIDENTIAL: RESIDENTIAL_ATTRIBUTES,
  LAND: LAND_ATTRIBUTES,
  COMMERCIAL: COMMERCIAL_ATTRIBUTES,
  INDUSTRIAL: INDUSTRIAL_ATTRIBUTES,
  MIXED: { ...RESIDENTIAL_ATTRIBUTES, ...COMMERCIAL_ATTRIBUTES },
  OTHER: {},
}

const BUILDING_ONLY_FIELDS = [
  "bedrooms",
  "bathrooms",
  "rooms",
  "floor",
  "totalFloors",
] as const

export function validateAttributes(
  category: PropertyCategory,
  attributes: Record<string, unknown>,
): void {
  const spec = ATTRIBUTE_SPECS[category]
  for (const [key, value] of Object.entries(attributes)) {
    const kind = spec[key]
    if (!kind) {
      throw propertyError(
        PropertyErrorCode.INVALID_PROPERTY_DATA,
        `attribut non autorisé (${key})`,
      )
    }
    if (!matches(kind, value)) {
      throw propertyError(
        PropertyErrorCode.INVALID_PROPERTY_DATA,
        `valeur invalide (${key})`,
      )
    }
  }
}

function matches(kind: AttributeKind, value: unknown): boolean {
  if (kind === "boolean") return typeof value === "boolean"
  if (kind === "integer") {
    return (
      Number.isInteger(value) &&
      (value as number) >= 0 &&
      (value as number) <= 10_000
    )
  }
  if (kind === "number") {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1_000_000
    )
  }
  return typeof value === "string" && kind.oneOf.includes(value)
}

export function validateCoordinates(
  latitude: number | null,
  longitude: number | null,
): void {
  if ((latitude === null) !== (longitude === null)) {
    throw propertyError(
      PropertyErrorCode.INVALID_LOCATION,
      "latitude et longitude vont ensemble",
    )
  }
  if (latitude === null || longitude === null) return
  const bounds = COTE_DIVOIRE_BOUNDS
  if (
    latitude < bounds.minLatitude ||
    latitude > bounds.maxLatitude ||
    longitude < bounds.minLongitude ||
    longitude > bounds.maxLongitude
  ) {
    throw propertyError(
      PropertyErrorCode.INVALID_LOCATION,
      "coordonnées hors de Côte d'Ivoire",
    )
  }
}

/** Cohérence des caractéristiques avec la catégorie du type de bien. */
export function validateCharacteristics(c: PropertyCharacteristics): void {
  if (c.category === "LAND") {
    for (const field of BUILDING_ONLY_FIELDS) {
      if (c[field] !== null) {
        throw propertyError(
          PropertyErrorCode.INVALID_PROPERTY_DATA,
          `${field} sans objet pour un terrain`,
        )
      }
    }
  }
  if (c.floor !== null && c.totalFloors !== null && c.floor > c.totalFloors) {
    throw propertyError(
      PropertyErrorCode.INVALID_PROPERTY_DATA,
      "floor dépasse totalFloors",
    )
  }
  validateCoordinates(c.latitude, c.longitude)
  validateAttributes(c.category, c.attributes)
}

/** Champs manquants pour activer le bien ou publier une annonce. */
export function missingForCompleteness(c: PropertyCharacteristics): string[] {
  const missing: string[] = []
  if (c.title.trim().length === 0) missing.push("title")
  if (c.latitude === null || c.longitude === null) missing.push("coordinates")
  if (c.category === "LAND") {
    if (c.landSurface === null) missing.push("landSurface")
  } else if (c.surface === null) {
    missing.push("surface")
  }
  if (c.category === "RESIDENTIAL") {
    if (c.bedrooms === null) missing.push("bedrooms")
    if (c.bathrooms === null) missing.push("bathrooms")
  }
  return missing
}

const PROPERTY_TRANSITIONS: Record<PropertyStatus, readonly PropertyStatus[]> =
  {
    DRAFT: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["INACTIVE", "ARCHIVED"],
    INACTIVE: ["ACTIVE", "ARCHIVED"],
    ARCHIVED: [],
  }

export function canTransitionProperty(
  from: PropertyStatus,
  to: PropertyStatus,
): boolean {
  return PROPERTY_TRANSITIONS[from].includes(to)
}

/** Statuts qui retirent le bien du catalogue public. */
export function isWithdrawal(status: PropertyStatus): boolean {
  return status === "INACTIVE" || status === "ARCHIVED"
}
