import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true })
loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true })

const url = process.env.TEST_DATABASE_URL
if (!url) {
  throw new Error("TEST_DATABASE_URL est absent")
}
if (!new URL(url).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL doit désigner une base *_test")
}

// L'application démarrée par les tests Identity lit DATABASE_URL : on la force
// sur la base de test avant tout import de l'AppModule.
process.env.DATABASE_URL = url
