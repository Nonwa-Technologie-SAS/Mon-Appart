import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/prisma/generated/client/client"

/** Bump after `prisma generate` so the dev singleton is not reused with a stale schema. */
const PRISMA_GENERATION = "visit-room-layout"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
  prismaGeneration: string | undefined
}

if (globalForPrisma.prismaGeneration !== PRISMA_GENERATION) {
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaGeneration = PRISMA_GENERATION
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  const pool = globalForPrisma.pgPool ?? new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool
    globalForPrisma.prisma = client
  }

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
