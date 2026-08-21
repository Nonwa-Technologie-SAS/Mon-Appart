import { PropertyStatus, PropertyType } from "@/prisma/generated/client/enums"

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
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(price)} F CFA`
}

export function formatRelativeTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - value.getTime()
  const hours = Math.max(1, Math.round(diffMs / 3_600_000))

  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `Il y a ${days} j`
  return value.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function formatPropertyType(type: PropertyType) {
  return typeLabels[type] ?? type
}

const statusLabels: Record<PropertyStatus, string> = {
  DRAFT: "Brouillon",
  AVAILABLE: "Disponible",
  RESERVED: "Non disponible",
  RENTED: "Non disponible",
  SOLD: "Non disponible",
  ARCHIVED: "Non disponible",
}

export function formatPropertyStatus(status: PropertyStatus) {
  return statusLabels[status] ?? status
}

export const PROPERTY_TYPE_OPTIONS = (
  Object.keys(typeLabels) as PropertyType[]
).map((value) => ({
  value,
  label: typeLabels[value],
}))
