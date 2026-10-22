import { describe, expect, it } from "vitest"

import { isAddressPublic, publicCoordinates } from "./location-privacy"
import {
  canViewPrivate,
  decideAccess,
  LEGAL_RELATIONS,
  MANAGING_RELATIONS,
  type AccessInput,
} from "./property-access"
import {
  canTransitionProperty,
  missingForCompleteness,
  validateAttributes,
  validateCharacteristics,
  validateCoordinates,
  type PropertyCharacteristics,
} from "./property-rules"

const villa: PropertyCharacteristics = {
  category: "RESIDENTIAL",
  title: "Villa Cocody",
  surface: 280,
  landSurface: null,
  bedrooms: 4,
  bathrooms: 3,
  rooms: null,
  floor: null,
  totalFloors: null,
  latitude: 5.3625,
  longitude: -3.9612,
  attributes: { parkingSpaces: 2, standing: "HAUT" },
}

const land: PropertyCharacteristics = {
  ...villa,
  category: "LAND",
  title: "Terrain Bingerville",
  surface: null,
  landSurface: 600,
  bedrooms: null,
  bathrooms: null,
  attributes: { serviced: true, landTitle: "ACD" },
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run()
    return undefined
  } catch (error) {
    return (error as { code?: string }).code
  }
}

describe("règles du bien", () => {
  it("accepte une villa et un terrain cohérents", () => {
    expect(() => validateCharacteristics(villa)).not.toThrow()
    expect(() => validateCharacteristics(land)).not.toThrow()
  })

  it("refuse des chambres sur un terrain", () => {
    expect(
      codeOf(() => validateCharacteristics({ ...land, bedrooms: 2 })),
    ).toBe("INVALID_PROPERTY_DATA")
  })

  it("refuse un étage au-delà du nombre d'étages", () => {
    expect(
      codeOf(() =>
        validateCharacteristics({ ...villa, floor: 5, totalFloors: 2 }),
      ),
    ).toBe("INVALID_PROPERTY_DATA")
  })

  it("filtre les attributs JSONB par catégorie", () => {
    expect(codeOf(() => validateAttributes("LAND", { parkingSpaces: 2 }))).toBe(
      "INVALID_PROPERTY_DATA",
    )
    expect(
      codeOf(() => validateAttributes("RESIDENTIAL", { standing: "LUXE" })),
    ).toBe("INVALID_PROPERTY_DATA")
    expect(
      codeOf(() => validateAttributes("RESIDENTIAL", { parkingSpaces: 1.5 })),
    ).toBe("INVALID_PROPERTY_DATA")
    expect(() =>
      validateAttributes("MIXED", { storefront: true, parkingSpaces: 3 }),
    ).not.toThrow()
  })

  it("contrôle les coordonnées : paire complète et Côte d'Ivoire", () => {
    expect(codeOf(() => validateCoordinates(5.36, null))).toBe(
      "INVALID_LOCATION",
    )
    expect(codeOf(() => validateCoordinates(48.85, 2.35))).toBe(
      "INVALID_LOCATION",
    )
    // Inversion latitude / longitude, erreur classique de saisie.
    expect(codeOf(() => validateCoordinates(-3.96, 5.36))).toBe(
      "INVALID_LOCATION",
    )
    expect(() => validateCoordinates(null, null)).not.toThrow()
    expect(() => validateCoordinates(5.36, -3.96)).not.toThrow()
  })

  it("liste les champs manquants pour activer", () => {
    expect(missingForCompleteness(villa)).toEqual([])
    expect(missingForCompleteness(land)).toEqual([])
    expect(
      missingForCompleteness({
        ...villa,
        latitude: null,
        longitude: null,
        bedrooms: null,
      }),
    ).toEqual(["coordinates", "bedrooms"])
    expect(missingForCompleteness({ ...land, landSurface: null })).toEqual([
      "landSurface",
    ])
  })

  it("applique la matrice de statut du bien", () => {
    expect(canTransitionProperty("DRAFT", "ACTIVE")).toBe(true)
    expect(canTransitionProperty("ACTIVE", "INACTIVE")).toBe(true)
    expect(canTransitionProperty("INACTIVE", "ACTIVE")).toBe(true)
    expect(canTransitionProperty("ACTIVE", "DRAFT")).toBe(false)
    expect(canTransitionProperty("ARCHIVED", "ACTIVE")).toBe(false)
  })
})

describe("politique d'accès", () => {
  const base: AccessInput = {
    relation: null,
    allowedRelations: MANAGING_RELATIONS,
    hasPermission: true,
    hasOverride: false,
    publiclyVisible: true,
  }

  it("autorise le propriétaire avec la permission", () => {
    expect(decideAccess({ ...base, relation: "SOLE" })).toBe("ALLOW")
  })

  it("refuse le propriétaire qui a perdu la permission", () => {
    expect(
      decideAccess({ ...base, relation: "SOLE", hasPermission: false }),
    ).toBe("FORBIDDEN")
  })

  it("refuse un tiers sur un bien public, masque un bien privé", () => {
    expect(decideAccess(base)).toBe("FORBIDDEN")
    expect(decideAccess({ ...base, publiclyVisible: false })).toBe("NOT_FOUND")
  })

  it("trace l'administration comme une dérogation", () => {
    expect(
      decideAccess({ ...base, hasOverride: true, publiclyVisible: false }),
    ).toBe("ALLOW_OVERRIDE")
  })

  it("autorise l'agent assigné mais pas à supprimer", () => {
    expect(decideAccess({ ...base, relation: "AGENT" })).toBe("ALLOW")
    expect(
      decideAccess({
        ...base,
        relation: "AGENT",
        allowedRelations: LEGAL_RELATIONS,
      }),
    ).toBe("FORBIDDEN")
  })

  it("réserve la vue privée aux gestionnaires et à l'admin", () => {
    expect(canViewPrivate("MANAGER", false)).toBe(true)
    expect(canViewPrivate(null, true)).toBe(true)
    expect(canViewPrivate(null, false)).toBe(false)
  })
})

describe("confidentialité de la localisation", () => {
  it("donne les coordonnées exactes seulement en EXACT", () => {
    expect(publicCoordinates("EXACT", 5.362512, -3.961234)).toEqual({
      latitude: 5.362512,
      longitude: -3.961234,
      precision: "EXACT",
    })
  })

  it("arrondit à ~1 km en APPROXIMATE", () => {
    expect(publicCoordinates("APPROXIMATE", 5.362512, -3.961234)).toEqual({
      latitude: 5.36,
      longitude: -3.96,
      precision: "APPROXIMATE",
    })
  })

  it("ne révèle rien en HIDDEN", () => {
    expect(publicCoordinates("HIDDEN", 5.36, -3.96)).toBeNull()
    expect(isAddressPublic("HIDDEN")).toBe(false)
    expect(isAddressPublic("APPROXIMATE")).toBe(false)
    expect(isAddressPublic("EXACT")).toBe(true)
  })
})
