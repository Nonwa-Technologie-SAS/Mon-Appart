import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "../../../app.module"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { TrustMaintenanceService } from "../application/trust-maintenance.service"

const USAGE = `Usage : node dist/modules/trust/cli/trust-cli.js <commande>

Commandes :
  maintenance   Expire les vérifications échues et retire les pièces
                des dossiers clos au-delà de la durée de rétention`

/**
 * Commandes d'exploitation Trust, exécutées depuis `dist`. La tâche en
 * processus est désactivée pour que seule la commande demandée s'exécute.
 * N'affiche que des compteurs.
 */
async function main(): Promise<void> {
  const [command] = process.argv.slice(2)
  if (command !== "maintenance") {
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
    return
  }
  process.env.TRUST_MAINTENANCE_INTERVAL_MINUTES = "0"
  process.env.MEDIA_WORKER_ENABLED = "false"
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    const result = await app.get(TrustMaintenanceService).run()
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error))
  process.exit(1)
})
