import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "../../../app.module"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { AggregationService } from "../application/aggregation.service"
import { AnalyticsWorker } from "../application/analytics-worker"
import { RetentionService } from "../application/retention.service"
import { addDays, isoDay } from "../domain/ingestion-rules"
import { parseDateRange } from "../domain/date-range"

const USAGE = `Usage : node dist/modules/analytics/cli/analytics-cli.js <commande>

Commandes :
  run                               Agrégation depuis le checkpoint puis purge
  recompute --from AAAA-MM-JJ [--to AAAA-MM-JJ]
                                    Recalcule les agrégats des jours indiqués
                                    (après correction d'une règle de calcul)
  purge                             Supprime les événements bruts au-delà
                                    de ANALYTICS_RETENTION_DAYS`

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

/**
 * Commandes d'exploitation Analytics, exécutées depuis `dist`. La tâche en
 * processus est désactivée pour que seule la commande demandée s'exécute.
 * N'affiche que des compteurs.
 */
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  if (command !== "run" && command !== "recompute" && command !== "purge") {
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
    return
  }
  const range =
    command === "recompute"
      ? parseDateRange(
          { from: option(args, "--from"), to: option(args, "--to") },
          { defaultDays: 1, maxDays: 400 },
        )
      : null
  process.env.ANALYTICS_WORKER_INTERVAL_MINUTES = "0"
  process.env.TRUST_MAINTENANCE_INTERVAL_MINUTES = "0"
  process.env.MEDIA_WORKER_ENABLED = "false"
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    if (command === "run") {
      console.log(JSON.stringify(await app.get(AnalyticsWorker).runOnce()))
    } else if (command === "purge") {
      const purged = await app.get(RetentionService).purge()
      console.log(JSON.stringify({ purged }))
    } else if (range) {
      const aggregation = app.get(AggregationService)
      const days: string[] = []
      const skipped: string[] = []
      for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
        const done = await aggregation.recomputeDay(day)
        ;(done ? days : skipped).push(isoDay(day))
      }
      console.log(JSON.stringify({ recomputed: days.length, skipped }))
    }
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error))
  process.exit(1)
})
