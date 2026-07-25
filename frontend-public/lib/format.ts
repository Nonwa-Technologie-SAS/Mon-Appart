import { PropertyType } from "@/prisma/generated/client/enums"

const typeLabels: Record<PropertyType, string> = {
  APARTMENT: "Appartement",
  HOUSE: "Maison",
  VILLA: "Villa",
  STUDIO: "Studio",
  LAND: "Terrain",
  OFFICE: "Bureau",
  COMMERCIAL: "Local commercial",
  OTHER: "Autre",
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatPropertyType(type: PropertyType) {
  return typeLabels[type] ?? type
}

export const PROPERTY_TYPE_OPTIONS = (
  Object.keys(typeLabels) as PropertyType[]
).map((value) => ({
  value,
  label: typeLabels[value],
}))
