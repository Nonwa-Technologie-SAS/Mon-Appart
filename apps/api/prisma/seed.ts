import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

loadEnv({ path: resolve(process.cwd(), ".env") })
loadEnv({ path: resolve(process.cwd(), "../../.env") })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL est absent")
  }

  const adapter = new PrismaPg({ connectionString, max: 2 })
  const prisma = new PrismaClient({ adapter })

  try {
    const rows = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT PostGIS_Version() AS version
    `
    const version = rows[0]?.version
    if (!version) {
      throw new Error("PostGIS ne répond pas")
    }
    console.log(`PostGIS ${version}`)
    console.log(
      "Aucun jeu de données métier : le schéma sera ajouté progressivement.",
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.name : "seed_failed"
  console.error(message)
  process.exit(1)
})
