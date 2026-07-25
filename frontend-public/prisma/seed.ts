import "dotenv/config"
import { randomUUID } from "node:crypto"

import { hashPassword } from "better-auth/crypto"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

import {
  PrismaClient,
  PropertyStatus,
  PropertyType,
  Role,
} from "./generated/client/client"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function upsertCredentialUser(params: {
  email: string
  name: string
  password: string
  role: Role
  agencyId?: string
}) {
  const existing = await prisma.user.findUnique({
    where: { email: params.email },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        role: params.role,
        agencyId: params.agencyId,
      },
    })

    const hashedPassword = await hashPassword(params.password)
    const account = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: "credential" },
    })

    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      })
    } else {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: existing.id,
          providerId: "credential",
          userId: existing.id,
          password: hashedPassword,
        },
      })
    }

    return existing
  }

  const userId = randomUUID()
  const hashedPassword = await hashPassword(params.password)

  const user = await prisma.user.create({
    data: {
      id: userId,
      email: params.email,
      name: params.name,
      role: params.role,
      agencyId: params.agencyId,
      emailVerified: true,
    },
  })

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
    },
  })

  return user
}

const demoListings = [
  {
    title: "Appartement lumineux — Champs-Élysées",
    description:
      "Appartement haussmannien rénové, proche métro et commerces. Séjour traversant, cuisine équipée, chambre calme sur cour.",
    location: "Paris 8e",
    type: PropertyType.APARTMENT,
    price: 1850,
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Maison avec jardin — Bordeaux",
    description:
      "Maison familiale au calme, jardin paysager et terrasse. Quatre chambres, garage, proximité écoles et tram.",
    location: "Bordeaux",
    type: PropertyType.HOUSE,
    price: 1450,
    image:
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Villa contemporaine — Nice",
    description:
      "Villa vue mer, piscine et grandes baies vitrées. Idéale pour séjour longue durée ou résidence principale.",
    location: "Nice",
    type: PropertyType.VILLA,
    price: 3200,
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Studio cosy — Lyon Part-Dieu",
    description:
      "Studio meublé optimisé, parfait pour étudiant ou jeune actif. Proche gare et commerces.",
    location: "Lyon",
    type: PropertyType.STUDIO,
    price: 720,
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Loft industriel — Lille",
    description:
      "Grand loft au caractère affirmé, volumes hauts et lumière du nord. Cuisine ouverte, deux chambres.",
    location: "Lille",
    type: PropertyType.APARTMENT,
    price: 1100,
    image:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Maison de ville — Nantes",
    description:
      "Maison de caractère, triple exposition, patio intérieur. À deux pas du centre et des bords de Loire.",
    location: "Nantes",
    type: PropertyType.HOUSE,
    price: 1280,
    image:
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80",
  },
] as const

async function main() {
  const defaultAgency = await prisma.agency.upsert({
    where: { email: "agence@prisma.io" },
    update: {},
    create: {
      name: "Agence Principale",
      address: "1 rue de la République, 75000 Paris",
      phone: "0102030405",
      email: "agence@prisma.io",
    },
  })

  const superAdmin = await upsertCredentialUser({
    email: "superadmin@prisma.io",
    name: "Super Admin",
    password: "superadminsecret",
    role: Role.SUPERADMIN,
  })

  const admin = await upsertCredentialUser({
    email: "admin@prisma.io",
    name: "Admin",
    password: "adminsecret",
    role: Role.ADMIN,
  })

  const owner = await upsertCredentialUser({
    email: "owner@prisma.io",
    name: "Propriétaire Démo",
    password: "ownersecret",
    role: Role.OWNER,
  })

  const agencyUser = await upsertCredentialUser({
    email: "agence-user@prisma.io",
    name: "Agent Démo",
    password: "agencysecret",
    role: Role.AGENCY,
    agencyId: defaultAgency.id,
  })

  const tenant = await upsertCredentialUser({
    email: "alice@prisma.io",
    name: "Alice",
    password: "securepassword1",
    role: Role.TENANT,
  })

  const properties = []

  for (const listing of demoListings) {
    let property = await prisma.property.findFirst({
      where: { title: listing.title },
    })

    if (!property) {
      property = await prisma.property.create({
        data: {
          title: listing.title,
          description: listing.description,
          location: listing.location,
          type: listing.type,
          price: listing.price,
          status: PropertyStatus.AVAILABLE,
          userId: owner.id,
          agencyId: defaultAgency.id,
          media: {
            create: { url: listing.image },
          },
          features: {
            create: [
              {
                name: "Pièces",
                value: listing.type === PropertyType.STUDIO ? "1" : "3+",
              },
              { name: "Disponibilité", value: "Immédiate" },
            ],
          },
        },
      })
    } else {
      property = await prisma.property.update({
        where: { id: property.id },
        data: {
          description: listing.description,
          location: listing.location,
          type: listing.type,
          price: listing.price,
          status: PropertyStatus.AVAILABLE,
        },
      })

      const mediaCount = await prisma.propertyMedia.count({
        where: { propertyId: property.id },
      })
      if (mediaCount === 0) {
        await prisma.propertyMedia.create({
          data: { propertyId: property.id, url: listing.image },
        })
      }
    }

    properties.push(property)
  }

  const favoriteProperty = properties[0]
  if (favoriteProperty) {
    await prisma.propertyFavorite.upsert({
      where: {
        userId_propertyId: {
          userId: tenant.id,
          propertyId: favoriteProperty.id,
        },
      },
      update: {},
      create: {
        userId: tenant.id,
        propertyId: favoriteProperty.id,
      },
    })
  }

  console.log({
    agency: defaultAgency,
    users: { superAdmin, admin, owner, agencyUser, tenant },
    properties: properties.length,
    credentials: {
      superadmin: "superadmin@prisma.io / superadminsecret",
      admin: "admin@prisma.io / adminsecret",
      owner: "owner@prisma.io / ownersecret",
      agency: "agence-user@prisma.io / agencysecret",
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
