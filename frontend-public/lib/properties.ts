import { cache } from "react"

import { MediaType, PropertyStatus, PropertyType } from "@/prisma/generated/client/enums"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/prisma/generated/client/client"

export type PropertyListItem = {
  id: string
  title: string
  description: string
  price: number
  type: PropertyType
  location: string
  imageUrl: string | null
  agencyName: string | null
}

export type PropertySearchParams = {
  q?: string
  type?: string
  maxPrice?: string
}

const listSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  type: true,
  location: true,
  agency: { select: { name: true } },
  media: {
    where: { type: MediaType.IMAGE },
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.PropertySelect

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
    imageUrl: property.media[0]?.url ?? null,
    agencyName: property.agency?.name ?? null,
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
    const properties = await prisma.property.findMany({
      where: buildWhere(params),
      select: listSelect,
      orderBy: { createdAt: "desc" },
      take: 48,
    })

    return properties.map(mapProperty)
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

export const getAvailablePropertyById = cache(async (id: string) => {
  return prisma.property.findFirst({
    where: { id, status: PropertyStatus.AVAILABLE },
    include: {
      media: { orderBy: { createdAt: "asc" } },
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
