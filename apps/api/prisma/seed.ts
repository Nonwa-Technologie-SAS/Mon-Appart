import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { seedDevelopmentData } from "./seed/development"
import { isProductionLike, isTestDatabase } from "./seed/environment"
import { seedReferenceData } from "./seed/reference"

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true })
loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true })

type SeedProfile = "reference" | "development"

// Profil `reference` : référentiels seuls (production, staging, test).
// Profil `development` : référentiels + données fictives, poste local uniquement.
function resolveProfile(connectionString: string): SeedProfile {
  const requested = parseProfile(process.env.SEED_PROFILE)
  const fallback: SeedProfile =
    isProductionLike() || isTestDatabase(connectionString)
      ? "reference"
      : "development"
  const profile: SeedProfile = requested ?? fallback

  if (profile === "development" && isProductionLike()) {
    throw new Error("Données de développement interdites hors local")
  }
  return profile
}

function parseProfile(value: string | undefined): SeedProfile | undefined {
  if (!value) {
    return undefined
  }
  if (value === "reference" || value === "development") {
    return value
  }
  throw new Error(`SEED_PROFILE inconnu : ${value}`)
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL est absent")
  }
  const profile = resolveProfile(connectionString)

  const adapter = new PrismaPg({ connectionString, max: 2 })
  const prisma = new PrismaClient({ adapter })

  try {
    await seedReferenceData(prisma)
    console.log("Référentiels à jour")

    if (profile === "development") {
      await seedDevelopmentData(prisma)
      console.log("Données de développement à jour")
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "seed_failed"
  console.error(`Seed interrompu : ${message}`)
  process.exit(1)
})
