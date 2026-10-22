import { config as loadEnv } from "dotenv"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import {
  databaseName,
  isProductionLike,
  isTestDatabase,
} from "../seed/environment"

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true })
loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true })

// Prépare la base de test : `migrate` applique les migrations et les
// référentiels ; `reset` recrée le schéma. Refuse toute base hors `*_test`.
const command = process.argv[2]
if (command !== "migrate" && command !== "reset") {
  fail("Usage : test-database.ts <migrate|reset>")
}

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  fail("TEST_DATABASE_URL est absent")
}
if (isProductionLike()) {
  fail("Interdit avec NODE_ENV=production ou APP_ENV=production/staging")
}
if (!isTestDatabase(testUrl)) {
  fail(`La base « ${databaseName(testUrl)} » ne finit pas par _test`)
}
if (
  process.env.DATABASE_URL &&
  databaseName(process.env.DATABASE_URL) === databaseName(testUrl)
) {
  fail("TEST_DATABASE_URL désigne la même base que DATABASE_URL")
}

const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  NODE_ENV: "test",
  APP_ENV: "test",
  SEED_PROFILE: "reference",
}

const steps =
  command === "reset"
    ? ["prisma migrate reset --force", "prisma db seed"]
    : ["prisma migrate deploy", "prisma db seed"]

console.log(`Base de test : ${databaseName(testUrl)}`)
for (const step of steps) {
  const result = spawnSync(step, { env, stdio: "inherit", shell: true })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
