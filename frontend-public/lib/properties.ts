import { cache } from "react"
import { connection } from "next/server"

import { MediaType, PropertyStatus, PropertyType } from "@/prisma/generated/client/enums"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/prisma/generated/client/client"
import { geocodeLocation, hasCoordinates } from "@/lib/geocode"
import { haversineKm, parseCoordinate } from "@/lib/geo"
import type { VisitLayoutItem } from "@/lib/visit-rooms"

export type PropertyListItem = {
  id: string
  title: string
  description: string
  price: number
  type: PropertyType
  location: string
  latitude: number | null
  longitude: number | null
  imageUrl: string | null
  agencyName: string | null
  createdAt: Date | string
  beds: string | null
  baths: string | null
  surface: string | null
  distanceKm: number | null
}

export type PropertySearchParams = {
  q?: string
  type?: string
  maxPrice?: string
  lat?: string
  lng?: string
}

const listSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  type: true,
  location: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  agency: { select: { name: true } },
  features: { select: { name: true, value: true } },
  media: {
    where: { type: MediaType.IMAGE },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.PropertySelect

function featureValue(
  features: { name: string; value: string }[],
  ...names: string[]
) {
  const normalized = names.map((name) => name.toLowerCase())
  return (
    features.find((feature) =>
      normalized.includes(feature.name.toLowerCase())
    )?.value ?? null
  )
}

function mapProperty(
  property: Prisma.PropertyGetPayload<{ select: typeof listSelect }>
): PropertyListItem {
  return {
    id: property.id,
    title: property.title,
    description: property.description,
    price: property.price,
    type: property.type,
    location: property.location,
    latitude: property.latitude,
    longitude: property.longitude,
    imageUrl: property.media[0]?.url ?? null,
    agencyName: property.agency?.name ?? null,
    createdAt: property.createdAt,
    beds: featureValue(property.features, "Chambres", "Pièces"),
    baths: featureValue(property.features, "Salles de bain"),
    surface: featureValue(property.features, "Surface"),
    distanceKm: null,
  }
}

function buildWhere(params: PropertySearchParams): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {
    status: PropertyStatus.AVAILABLE,
  }

  const q = params.q?.trim()
  if (q) {
    where.OR = [
      { location: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ]
  }

  if (
    params.type &&
    Object.values(PropertyType).includes(params.type as PropertyType)
  ) {
    where.type = params.type as PropertyType
  }

  const maxPrice = params.maxPrice ? Number(params.maxPrice) : NaN
  if (!Number.isNaN(maxPrice) && maxPrice > 0) {
    where.price = { lte: maxPrice }
  }

  return where
}

export const searchAvailableProperties = cache(
  async (params: PropertySearchParams = {}) => {
    const originLat = parseCoordinate(params.lat)
    const originLng = parseCoordinate(params.lng)
    const origin =
      originLat != null && originLng != null
        ? { lat: originLat, lng: originLng }
        : null

    const properties = await prisma.property.findMany({
      where: buildWhere(params),
      select: listSelect,
      orderBy: { createdAt: "desc" },
      take: 80,
    })

    const mapped = properties.map((property) => {
      const item = mapProperty(property)
      if (
        !origin ||
        property.latitude == null ||
        property.longitude == null
      ) {
        return item
      }

      return {
        ...item,
        distanceKm: haversineKm(origin, {
          lat: property.latitude,
          lng: property.longitude,
        }),
      }
    })

    if (!origin) return mapped

    return mapped.toSorted((a, b) => {
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })
  }
)

export const getFeaturedProperties = cache(async () => {
  const properties = await prisma.property.findMany({
    where: { status: PropertyStatus.AVAILABLE },
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take: 6,
  })

  return properties.map(mapProperty)
})

export type OwnerPropertyListItem = PropertyListItem & {
  status: PropertyStatus
}

export async function listPropertiesByUserId(userId: string) {
  const properties = await prisma.property.findMany({
    where: { userId },
    select: {
      ...listSelect,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return properties.map((property) => ({
    ...mapProperty(property),
    status: property.status,
  }))
}

export async function createPropertyForUser(
  userId: string,
  agencyId: string | null | undefined,
  input: {
    title: string
    description: string
    price: number
    type: PropertyType
    location: string
    latitude?: number | null
    longitude?: number | null
    imageUrl?: string
    imageUrls?: string[]
    imageLayout?: VisitLayoutItem[]
    beds?: string
    baths?: string
    surface?: string
    publish?: boolean
    status?: PropertyStatus
  },
  propertyId?: string
) {
  const features = [
    input.beds
      ? { name: "Chambres", value: input.beds }
      : null,
    input.baths
      ? { name: "Salles de bain", value: input.baths }
      : null,
    input.surface
      ? { name: "Surface", value: input.surface }
      : null,
  ].filter((feature): feature is { name: string; value: string } =>
    Boolean(feature)
  )

  const imageLayout: VisitLayoutItem[] =
    input.imageLayout && input.imageLayout.length > 0
      ? input.imageLayout
      : [
          ...(input.imageUrls ?? []),
          ...(input.imageUrl ? [input.imageUrl] : []),
        ].map((url, index) => ({
          url,
          room: "OTHER" as const,
          sortOrder: index,
        }))

  let latitude = input.latitude ?? null
  let longitude = input.longitude ?? null
  if (!hasCoordinates(latitude, longitude)) {
    const coords = await geocodeLocation(input.location)
    latitude = coords.lat
    longitude = coords.lng
  }

  const property = await prisma.property.create({
    data: {
      ...(propertyId ? { id: propertyId } : {}),
      title: input.title,
      description: input.description,
      price: input.price,
      type: input.type,
      location: input.location,
      latitude,
      longitude,
      status:
        input.status ??
        (input.publish === false
          ? PropertyStatus.ARCHIVED
          : PropertyStatus.AVAILABLE),
      userId,
      agencyId: agencyId ?? null,
      ...(features.length > 0 ? { features: { create: features } } : {}),
      ...(imageLayout.length > 0
        ? {
            media: {
              create: imageLayout.map((item) => ({
                url: item.url,
                type: MediaType.IMAGE,
                room: item.room,
                sortOrder: item.sortOrder,
              })),
            },
          }
        : {}),
    },
    select: {
      ...listSelect,
      status: true,
    },
  })

  return {
    ...mapProperty(property),
    status: property.status,
  }
}

export async function updateOwnedPropertyStatus(
  propertyId: string,
  userId: string,
  status: PropertyStatus,
  asStaff = false
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, userId: true },
  })

  if (!property) return null
  if (!asStaff && property.userId !== userId) {
    throw new Error("Forbidden")
  }

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { status },
    select: {
      ...listSelect,
      status: true,
    },
  })

  return {
    ...mapProperty(updated),
    status: updated.status,
  }
}

export const getAvailablePropertyById = cache(async (
  id: string,
  viewerUserId?: string
) => {
  await connection()
  return prisma.property.findFirst({
    where: viewerUserId
      ? {
          id,
          OR: [
            { status: PropertyStatus.AVAILABLE },
            { userId: viewerUserId },
          ],
        }
      : { id, status: PropertyStatus.AVAILABLE },
    include: {
      media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      features: true,
      amenities: { include: { amenity: true } },
      agency: { select: { name: true, phone: true, email: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } } },
      },
    },
  })
})
