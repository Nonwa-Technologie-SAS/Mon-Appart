import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "../../../app.module"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { IdentityRetentionService } from "../application/services/identity-retention.service"

const USAGE = `Usage : node dist/modules/identity/cli/identity-cli.js <commande>

Commandes :
  purge-artifacts   Supprime OTP expirés/consommés, jetons de reset
                    expirés/utilisés, et sessions hors rétention`

/**
 * Exploitation Identity. Désactive les workers périodiques pour n'exécuter
 * que la commande demandée. N'affiche que des compteurs.
 */
async function main(): Promise<void> {
  const [command] = process.argv.slice(2)
  if (command !== "purge-artifacts") {
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
    return
  }
  process.env.IDENTITY_RETENTION_INTERVAL_MINUTES = "0"
  process.env.MEDIA_WORKER_ENABLED = "false"
  process.env.TRUST_MAINTENANCE_INTERVAL_MINUTES = "0"
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    const result = await app.get(IdentityRetentionService).purge()
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error))
  process.exit(1)
})
