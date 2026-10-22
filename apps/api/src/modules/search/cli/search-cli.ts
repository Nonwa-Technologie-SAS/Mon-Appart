import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "../../../app.module"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { SearchReindexService } from "../application/search-reindex.service"
import { PostgresIndexStore } from "../infrastructure/postgres/postgres-index.store"
import { SearchSourceRepository } from "../infrastructure/postgres/search-source.repository"
import { SearchEngineFactory } from "../infrastructure/search-engine.factory"

const USAGE = `Usage : node dist/modules/search/cli/search-cli.js <commande> [options]

Commandes :
  reindex   Reconstruit les index depuis PostgreSQL (source de vérité)
            --target=postgres|opensearch|all   (défaut : all = cibles configurées)
            --batch=<n>                         taille des lots (défaut SEARCH_REINDEX_BATCH_SIZE)
            --after=<id>                        reprise après le dernier id affiché (postgres)
  health    État des moteurs de recherche
  stats     Nombre d'annonces indexables et de documents indexés`

function option(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

/**
 * Commandes d'exploitation Search. Exécutées depuis `dist` (métadonnées de
 * décorateurs nécessaires à Nest). N'affiche jamais de configuration.
 */
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  if (!command || !["reindex", "health", "stats"].includes(command)) {
    console.log(USAGE)
    process.exitCode = command ? 1 : 0
    return
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    if (command === "reindex") {
      const target = option(args, "target") ?? "all"
      if (!["postgres", "opensearch", "all"].includes(target)) {
        throw new Error("--target invalide")
      }
      const batch = option(args, "batch")
      const after = option(args, "after")
      if (batch !== undefined && !/^\d+$/.test(batch))
        throw new Error("--batch invalide")
      if (after !== undefined && !/^\d+$/.test(after))
        throw new Error("--after invalide")
      const started = Date.now()
      const report = await app.get(SearchReindexService).reindex({
        targets:
          target === "all"
            ? ["postgres", "opensearch"]
            : [target as "postgres" | "opensearch"],
        batchSize: batch ? Number(batch) : undefined,
        afterId: after ? BigInt(after) : undefined,
        onProgress: ({ processed, total, lastId }) => {
          console.log(`… ${processed}/${total} annonces (dernier id ${lastId})`)
        },
      })
      console.log(
        JSON.stringify(
          {
            processed: report.processed,
            orphansDeleted: report.orphansDeleted,
            opensearch: report.opensearch,
            durationMs: Date.now() - started,
          },
          null,
          2,
        ),
      )
      if (report.opensearch && report.opensearch.failed > 0)
        process.exitCode = 1
    } else if (command === "health") {
      const engines = app.get(SearchEngineFactory)
      const checks = {
        postgres: await engines.postgres.health(),
        opensearch: engines.opensearch
          ? await engines.opensearch.health()
          : "non configuré",
      }
      console.log(JSON.stringify(checks, null, 2))
    } else {
      const engines = app.get(SearchEngineFactory)
      const stats = {
        indexable: await app.get(SearchSourceRepository).countIndexable(),
        postgresDocuments: await app.get(PostgresIndexStore).count(),
        opensearchDocuments: engines.opensearchStore
          ? await engines.opensearchStore.count().catch(() => null)
          : null,
      }
      console.log(JSON.stringify(stats, null, 2))
    }
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error))
  process.exit(1)
})
