import type { PrismaClient } from "../../src/generated/prisma/client"
import {
  AMENITIES,
  CITY,
  COMMUNES,
  COUNTRY,
  DEFAULT_BILLING_PLAN,
  DISTRICT,
  MODERATION_REASONS,
  PERMISSIONS,
  PROPERTY_TYPES,
  ROLE_PERMISSIONS,
  ROLES,
} from "./reference-data"

/** Données de référence, valables dans tous les environnements. */
export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  await seedLocations(prisma)
  await seedAccessControl(prisma)
  await seedCatalogs(prisma)
}

async function seedLocations(prisma: PrismaClient): Promise<void> {
  const country = await prisma.country.upsert({
    where: { code: COUNTRY.code },
    create: COUNTRY,
    update: { name: COUNTRY.name },
  })

  const district = await prisma.district.upsert({
    where: { countryId_code: { countryId: country.id, code: DISTRICT.code } },
    create: { ...DISTRICT, countryId: country.id },
    update: { name: DISTRICT.name },
  })

  const city = await prisma.city.upsert({
    where: { districtId_code: { districtId: district.id, code: CITY.code } },
    create: { ...CITY, districtId: district.id },
    update: { name: CITY.name },
  })

  for (const { neighborhoods, ...commune } of COMMUNES) {
    const savedCommune = await prisma.commune.upsert({
      where: { cityId_code: { cityId: city.id, code: commune.code } },
      create: { ...commune, cityId: city.id },
      update: { name: commune.name },
    })

    for (const neighborhood of neighborhoods) {
      await prisma.neighborhood.upsert({
        where: {
          communeId_code: {
            communeId: savedCommune.id,
            code: neighborhood.code,
          },
        },
        create: { ...neighborhood, communeId: savedCommune.id },
        update: { name: neighborhood.name },
      })
    }
  }
}

async function seedAccessControl(prisma: PrismaClient): Promise<void> {
  const roleIds = new Map<string, number>()
  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      create: role,
      update: { name: role.name, description: role.description },
    })
    roleIds.set(role.code, saved.id)
  }

  const permissionIds = new Map<string, number>()
  for (const permission of PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { name: permission.name },
    })
    permissionIds.set(permission.code, saved.id)
  }

  const links = Object.entries(ROLE_PERMISSIONS).flatMap(([roleCode, codes]) =>
    codes.map((permissionCode) => ({
      roleId: requireId(roleIds, roleCode),
      permissionId: requireId(permissionIds, permissionCode),
    })),
  )
  await prisma.rolePermission.createMany({ data: links, skipDuplicates: true })
}

async function seedCatalogs(prisma: PrismaClient): Promise<void> {
  for (const type of PROPERTY_TYPES) {
    await prisma.propertyType.upsert({
      where: { code: type.code },
      create: type,
      update: { name: type.name, category: type.category },
    })
  }

  for (const amenity of AMENITIES) {
    await prisma.amenity.upsert({
      where: { code: amenity.code },
      create: amenity,
      update: { name: amenity.name, category: amenity.category },
    })
  }

  await prisma.moderationReason.createMany({
    data: [...MODERATION_REASONS],
    skipDuplicates: true,
  })

  const defaultPlan = await prisma.billingProduct.findFirst({
    where: { isDefault: true },
    select: { id: true },
  })
  if (!defaultPlan) {
    await prisma.billingProduct.createMany({
      data: [DEFAULT_BILLING_PLAN],
      skipDuplicates: true,
    })
  }
}

function requireId(ids: Map<string, number>, code: string): number {
  const id = ids.get(code)
  if (id === undefined) {
    throw new Error(`Référence inconnue : ${code}`)
  }
  return id
}
