import { hashPassword } from "../../src/common/security/password-hasher"
import type {
  ListingType,
  LocationVisibility,
  PricePeriod,
  PrismaClient,
} from "../../src/generated/prisma/client"

/** Mot de passe local documenté (docs/web-nest-cutover.md). Jamais en prod. */
export const DEMO_PASSWORD = "Demo-Password-2026!"

// Identifiants publics fixes : le seed peut être rejoué sans créer de doublons.
const DEMO_USERS = [
  {
    publicId: "00000000-0000-4000-8000-000000000001",
    email: "owner@demo.mon-appart.local",
    phone: "+2250700000001",
    firstName: "Awa",
    lastName: "Koné",
    role: "OWNER",
  },
  {
    publicId: "00000000-0000-4000-8000-000000000002",
    email: "customer@demo.mon-appart.local",
    phone: "+2250700000002",
    firstName: "Yao",
    lastName: "Kouassi",
    role: "CUSTOMER",
  },
  {
    publicId: "00000000-0000-4000-8000-000000000003",
    email: "agent@demo.mon-appart.local",
    phone: "+2250700000003",
    firstName: "Mariam",
    lastName: "Traoré",
    role: "AGENT",
  },
] as const

interface DemoProperty {
  publicId: string
  listingPublicId: string
  communeCode: string
  neighborhoodCode: string
  typeCode: string
  title: string
  surface?: string
  landSurface?: string
  bedrooms?: number
  bathrooms?: number
  latitude: string
  longitude: string
  locationVisibility: LocationVisibility
  attributes?: Record<string, string | number | boolean>
  amenities: readonly string[]
  listingType: ListingType
  price: string
  period: PricePeriod
  /** Agent mandaté en plus du propriétaire. */
  withAgent?: boolean
}

const DEMO_PROPERTIES: readonly DemoProperty[] = [
  {
    publicId: "00000000-0000-4000-8000-000000000101",
    listingPublicId: "00000000-0000-4000-8000-000000000201",
    communeCode: "COCODY",
    neighborhoodCode: "RIVIERA",
    typeCode: "APARTMENT",
    title: "Appartement 3 pièces Riviera 3",
    surface: "95.00",
    bedrooms: 2,
    bathrooms: 2,
    latitude: "5.359000",
    longitude: "-3.958000",
    locationVisibility: "APPROXIMATE",
    amenities: ["PARKING", "SECURITY", "AIR_CONDITIONING"],
    listingType: "RENT",
    price: "350000.00",
    period: "MONTH",
  },
  {
    publicId: "00000000-0000-4000-8000-000000000102",
    listingPublicId: "00000000-0000-4000-8000-000000000202",
    communeCode: "MARCORY",
    neighborhoodCode: "ZONE_4",
    typeCode: "VILLA",
    title: "Villa 5 pièces Zone 4 avec piscine",
    surface: "320.00",
    bedrooms: 4,
    bathrooms: 4,
    latitude: "5.293000",
    longitude: "-3.985000",
    locationVisibility: "APPROXIMATE",
    amenities: ["PARKING", "SWIMMING_POOL", "GARDEN", "GENERATOR"],
    listingType: "SALE",
    price: "450000000.00",
    period: "TOTAL",
  },
  {
    publicId: "00000000-0000-4000-8000-000000000103",
    listingPublicId: "00000000-0000-4000-8000-000000000203",
    communeCode: "COCODY",
    neighborhoodCode: "RIVIERA",
    typeCode: "VILLA",
    title: "Villa 4 chambres Cocody Riviera",
    surface: "280.00",
    bedrooms: 4,
    bathrooms: 3,
    latitude: "5.362500",
    longitude: "-3.961200",
    locationVisibility: "APPROXIMATE",
    amenities: ["PARKING", "SECURITY", "GARDEN", "AIR_CONDITIONING"],
    listingType: "RENT",
    price: "1500000.00",
    period: "MONTH",
    withAgent: true,
  },
  {
    publicId: "00000000-0000-4000-8000-000000000104",
    listingPublicId: "00000000-0000-4000-8000-000000000204",
    communeCode: "BINGERVILLE",
    neighborhoodCode: "FEH_KESSE",
    typeCode: "LAND",
    title: "Terrain 600 m² Bingerville Feh Kessé",
    landSurface: "600.00",
    latitude: "5.355800",
    longitude: "-3.885400",
    locationVisibility: "APPROXIMATE",
    attributes: { serviced: true, landTitle: "ACD", fenced: false },
    amenities: [],
    listingType: "SALE",
    price: "50000000.00",
    period: "TOTAL",
  },
]

/** Données fictives pour le poste de développement. Jamais en production. */
export async function seedDevelopmentData(prisma: PrismaClient): Promise<void> {
  const userIds = new Map<string, bigint>()

  const passwordHash = await hashPassword(DEMO_PASSWORD)

  for (const { role, ...user } of DEMO_USERS) {
    const saved = await prisma.user.upsert({
      where: { publicId: user.publicId },
      create: {
        ...user,
        passwordHash,
        status: "ACTIVE",
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
      update: {
        passwordHash,
        status: "ACTIVE",
      },
    })
    const roleRecord = await prisma.role.findUniqueOrThrow({
      where: { code: role },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: saved.id, roleId: roleRecord.id } },
      create: { userId: saved.id, roleId: roleRecord.id },
      update: {},
    })
    userIds.set(role, saved.id)
  }

  const ownerId = userIds.get("OWNER")
  const agentId = userIds.get("AGENT")
  if (ownerId === undefined || agentId === undefined) {
    throw new Error("Utilisateurs de démonstration OWNER/AGENT absents")
  }

  for (const demo of DEMO_PROPERTIES) {
    await seedDemoProperty(prisma, demo, ownerId, agentId)
  }
}

async function seedDemoProperty(
  prisma: PrismaClient,
  demo: DemoProperty,
  ownerId: bigint,
  agentId: bigint,
): Promise<void> {
  const [neighborhood, propertyType] = await Promise.all([
    prisma.neighborhood.findFirstOrThrow({
      where: {
        code: demo.neighborhoodCode,
        commune: { code: demo.communeCode },
      },
    }),
    prisma.propertyType.findUniqueOrThrow({ where: { code: demo.typeCode } }),
  ])

  const property = await prisma.property.upsert({
    where: { publicId: demo.publicId },
    create: {
      publicId: demo.publicId,
      propertyTypeId: propertyType.id,
      neighborhoodId: neighborhood.id,
      title: demo.title,
      surface: demo.surface ?? null,
      landSurface: demo.landSurface ?? null,
      bedrooms: demo.bedrooms ?? null,
      bathrooms: demo.bathrooms ?? null,
      latitude: demo.latitude,
      longitude: demo.longitude,
      locationVisibility: demo.locationVisibility,
      attributes: demo.attributes ?? {},
      status: "ACTIVE",
    },
    update: {},
  })

  const currentOwnerships = await prisma.propertyOwnership.findMany({
    where: { propertyId: property.id, isCurrent: true },
    select: { ownerId: true },
  })
  const currentIds = new Set(currentOwnerships.map((row) => row.ownerId))
  if (!currentIds.has(ownerId)) {
    await prisma.propertyOwnership.create({
      data: { propertyId: property.id, ownerId, ownershipType: "SOLE" },
    })
  }
  if (demo.withAgent && !currentIds.has(agentId)) {
    await prisma.propertyOwnership.create({
      data: {
        propertyId: property.id,
        ownerId: agentId,
        ownershipType: "AGENT",
      },
    })
  }

  if (demo.amenities.length > 0) {
    const amenities = await prisma.amenity.findMany({
      where: { code: { in: [...demo.amenities] } },
      select: { id: true },
    })
    await prisma.propertyAmenity.createMany({
      data: amenities.map((amenity) => ({
        propertyId: property.id,
        amenityId: amenity.id,
      })),
      skipDuplicates: true,
    })
  }

  const existingListing = await prisma.listing.findUnique({
    where: { publicId: demo.listingPublicId },
  })
  if (existingListing) {
    return
  }

  const publishedAt = new Date()
  await prisma.listing.create({
    data: {
      publicId: demo.listingPublicId,
      propertyId: property.id,
      createdById: ownerId,
      listingType: demo.listingType,
      status: "PUBLISHED",
      title: demo.title,
      publishedAt,
      prices: {
        create: { amount: demo.price, currency: "XOF", period: demo.period },
      },
      statusHistory: {
        create: [
          { newStatus: "DRAFT", changedById: ownerId },
          { oldStatus: "DRAFT", newStatus: "PUBLISHED", changedById: ownerId },
        ],
      },
    },
  })
}
