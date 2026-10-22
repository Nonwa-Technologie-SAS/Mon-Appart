/**
 * Enums UI web — indépendants de Prisma legacy.
 * Alignés sur les codes Nest / affichage historique du prototype.
 */

export const Role = {
  VISITOR: "VISITOR",
  TENANT: "TENANT",
  CUSTOMER: "CUSTOMER",
  OWNER: "OWNER",
  AGENCY: "AGENCY",
  AGENT: "AGENT",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const PropertyType = {
  APARTMENT: "APARTMENT",
  HOUSE: "HOUSE",
  VILLA: "VILLA",
  STUDIO: "STUDIO",
  LAND: "LAND",
  OFFICE: "OFFICE",
  COMMERCIAL: "COMMERCIAL",
  OTHER: "OTHER",
} as const

export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType]

export const PropertyStatus = {
  DRAFT: "DRAFT",
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  RENTED: "RENTED",
  SOLD: "SOLD",
  ARCHIVED: "ARCHIVED",
} as const

export type PropertyStatus = (typeof PropertyStatus)[keyof typeof PropertyStatus]

export const MediaType = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  VIRTUAL_TOUR: "VIRTUAL_TOUR",
  FLOOR_PLAN: "FLOOR_PLAN",
} as const

export type MediaType = (typeof MediaType)[keyof typeof MediaType]

export const VisitStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
} as const

export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus]
