import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "../../../app.module"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { MediaCleanupService } from "../application/media-cleanup.service"
import { MediaJobRunner } from "../application/media-job-runner"
import { MediaRepository } from "../infrastructure/media.repository"

const USAGE = `Usage : node dist/modules/media/cli/media-cli.js <commande> [options]

Commandes :
  process   Traite les médias en attente (file en base)
            --max=<n>     nombre maximal de travaux (défaut 100)
  cleanup   Expire les sessions non confirmées et purge les médias échus
  orphans   Recherche les objets de stockage sans média vivant
            (simulation par défaut ; --apply supprime réellement)
  stats     Nombre de travaux en attente`

const COMMANDS = ["process", "cleanup", "orphans", "stats"]

function option(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

/**
 * Commandes d'exploitation Media. Exécutées depuis `dist`. Le worker intégré
 * est désactivé pour que seule la commande demandée s'exécute. N'affiche ni
 * configuration, ni clé de stockage, ni URL signée.
 */
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  if (!command || !COMMANDS.includes(command)) {
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
    return
  }
  const max = option(args, "max")
  if (max !== undefined && !/^\d+$/.test(max)) throw new Error("--max invalide")

  process.env.MEDIA_WORKER_ENABLED = "false"
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    if (command === "process") {
      const counts = await app
        .get(MediaJobRunner)
        .runOnce(max ? Number(max) : undefined)
      console.log(JSON.stringify(counts, null, 2))
    } else if (command === "cleanup") {
      const cleanup = app.get(MediaCleanupService)
      const expired = await cleanup.expireSessions()
      const purged = await cleanup.purgeDue()
      console.log(JSON.stringify({ expired, purged }, null, 2))
    } else if (command === "orphans") {
      const report = await app
        .get(MediaCleanupService)
        .scanOrphans(!args.includes("--apply"))
      console.log(JSON.stringify(report, null, 2))
    } else {
      const pending = await app.get(MediaRepository).countPendingJobs()
      console.log(JSON.stringify({ pendingJobs: pending }, null, 2))
    }
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error))
  process.exit(1)
})
