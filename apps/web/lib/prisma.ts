import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/prisma/generated/client/client"

/** Bump after `prisma generate` or pool config changes so the dev singleton is not reused. */
const PRISMA_GENERATION = "prisma-postgres-keepalive-v1"

const RETRYABLE_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
])

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: { end: () => Promise<void> } | undefined
  prismaGeneration: string | undefined
}

if (globalForPrisma.prismaGeneration !== PRISMA_GENERATION) {
  void globalForPrisma.prisma?.$disconnect().catch(() => undefined)
  void globalForPrisma.pgPool?.end().catch(() => undefined)
  globalForPrisma.pgPool = undefined
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaGeneration = PRISMA_GENERATION
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  // Prisma Postgres closes idle sockets quickly. Recycle before the server does,
  // and keep TCP alive so the pooler does not drop the connection mid-request.
  const adapter = new PrismaPg(
    {
      connectionString,
      max: 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5_000,
    },
    {
      onPoolError: (error) => {
        console.error("PostgreSQL pool error:", error.message)
      },
    }
  )

  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export function isRetryablePrismaError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const code = "code" in error ? String(error.code) : ""
  if (RETRYABLE_CODES.has(code)) return true

  const name = "name" in error ? String(error.name) : ""
  const message = "message" in error ? String(error.message) : ""
  const cause =
    "cause" in error && error.cause && typeof error.cause === "object"
      ? error.cause
      : null
  const causeName =
    cause && "name" in cause ? String(cause.name) : ""
  const causeMessage =
    cause && "message" in cause ? String(cause.message) : ""

  return (
    name === "DriverAdapterError" ||
    causeName === "DriverAdapterError" ||
    /ConnectionClosed|Server has closed the connection|ECONNRESET|connection terminated/i.test(
      `${message} ${causeMessage}`
    )
  )
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  retries = 2
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isRetryablePrismaError(error) || retries <= 0) {
      throw error
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
    return withPrismaRetry(operation, retries - 1)
  }
}
