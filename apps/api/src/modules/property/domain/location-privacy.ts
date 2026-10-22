import type { LocationVisibility } from "../../../generated/prisma/enums"

/** 2 décimales ≈ 1,1 km à l'équateur : assez pour situer, pas pour trouver la porte. */
export const APPROXIMATE_DECIMALS = 2

/** Écart maximal entre la position réelle et la position arrondie (diagonale ≈ 790 m). */
export const APPROXIMATE_MAX_SHIFT_METERS = 1_000

export interface PublicCoordinates {
  latitude: number
  longitude: number
  precision: "EXACT" | "APPROXIMATE"
}

/**
 * Coordonnées publiables selon le choix du propriétaire. HIDDEN ne révèle que
 * la commune et le quartier ; l'adresse n'est publique qu'en mode EXACT.
 */
export function publicCoordinates(
  visibility: LocationVisibility,
  latitude: number | null,
  longitude: number | null,
): PublicCoordinates | null {
  if (latitude === null || longitude === null || visibility === "HIDDEN") {
    return null
  }
  if (visibility === "EXACT") return { latitude, longitude, precision: "EXACT" }
  const factor = 10 ** APPROXIMATE_DECIMALS
  return {
    latitude: Math.round(latitude * factor) / factor,
    longitude: Math.round(longitude * factor) / factor,
    precision: "APPROXIMATE",
  }
}

export function isAddressPublic(visibility: LocationVisibility): boolean {
  return visibility === "EXACT"
}
