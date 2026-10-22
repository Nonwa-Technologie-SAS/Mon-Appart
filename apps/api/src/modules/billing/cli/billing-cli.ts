import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "../../../app.module"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { ReconciliationService } from "../application/reconciliation.service"

const USAGE = `Usage : node dist/modules/billing/cli/billing-cli.js <commande>

Commandes :
  reconcile   Expire les commandes échues, interroge le prestataire pour les
              paiements et remboursements en suspens, applique les échéances
              d'abonnement et envoie les rappels de renouvellement`

/**
 * Commandes d'exploitation Billing, exécutées depuis `dist`. La tâche en
 * processus est désactivée pour que seule la commande demandée s'exécute.
 * N'affiche que des compteurs.
 */
async function main(): Promise<void> {
  const [command] = process.argv.slice(2)
  if (command !== "reconcile") {
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
    return
  }
  process.env.BILLING_WORKER_INTERVAL_MINUTES = "0"
  process.env.TRUST_MAINTENANCE_INTERVAL_MINUTES = "0"
  process.env.MEDIA_WORKER_ENABLED = "false"
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    const result = await app.get(ReconciliationService).run()
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error))
  process.exit(1)
})
