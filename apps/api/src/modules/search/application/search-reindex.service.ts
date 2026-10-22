import { Injectable } from "@nestjs/common"

import { buildListingSearchDocument } from "../domain/listing-search-document"
import { PostgresIndexStore } from "../infrastructure/postgres/postgres-index.store"
import { SearchSourceRepository } from "../infrastructure/postgres/search-source.repository"
import { SearchCache } from "../infrastructure/search-cache"
import { SearchEngineFactory } from "../infrastructure/search-engine.factory"
import { SearchConfig } from "../search.config"

export interface ReindexProgress {
  processed: number
  total: number
  lastId: bigint
}

export interface ReindexOptions {
  /** Reprise après interruption : dernier id traité affiché par la progression. */
  afterId?: bigint
  batchSize?: number
  /** `postgres`, `opensearch` ou les deux (défaut : les cibles configurées). */
  targets?: Array<"postgres" | "opensearch">
  onProgress?: (progress: ReindexProgress) => void
}

export interface ReindexReport {
  processed: number
  orphansDeleted: number
  opensearch: { index: string; previous: string[]; failed: number } | null
}

/**
 * Reconstruction complète depuis PostgreSQL, par lots ordonnés par id :
 * mémoire bornée, reprise possible avec `afterId`. OpenSearch reçoit un
 * nouvel index versionné, activé par bascule d'alias à la fin seulement.
 */
@Injectable()
export class SearchReindexService {
  constructor(
    private readonly config: SearchConfig,
    private readonly source: SearchSourceRepository,
    private readonly postgres: PostgresIndexStore,
    private readonly engines: SearchEngineFactory,
    private readonly cache: SearchCache,
  ) {}

  async reindex(options: ReindexOptions = {}): Promise<ReindexReport> {
    const targets = new Set(options.targets ?? ["postgres", "opensearch"])
    const store = targets.has("opensearch")
      ? this.engines.opensearchStore
      : null
    const batchSize = options.batchSize ?? this.config.reindexBatchSize
    if (store && options.afterId !== undefined && options.afterId > 0n) {
      // Un nouvel index OpenSearch partiel ne doit jamais être activé.
      throw new Error(
        "La reprise (--after) n'est possible qu'avec --target=postgres",
      )
    }
    const total = await this.source.countIndexable()

    const opensearchIndex = store ? await store.createVersionedIndex() : null
    let failed = 0
    let processed = 0
    let lastId = options.afterId ?? 0n
    for (;;) {
      const batch = await this.source.batch(lastId, batchSize)
      if (batch.length === 0) break
      const documents = batch.map((entry) => ({
        id: entry.internalId,
        document: buildListingSearchDocument(entry.source),
      }))
      if (targets.has("postgres")) {
        for (const { id, document } of documents) {
          await this.postgres.upsert(id, document)
        }
      }
      if (store && opensearchIndex) {
        failed += await store.bulkIndex(
          opensearchIndex,
          documents.map((entry) => entry.document),
        )
      }
      processed += batch.length
      lastId = batch[batch.length - 1]!.internalId
      options.onProgress?.({ processed, total, lastId })
    }

    const orphansDeleted = targets.has("postgres")
      ? await this.postgres.deleteOrphans()
      : 0
    let opensearch: ReindexReport["opensearch"] = null
    if (store && opensearchIndex) {
      // Un index incomplet n'est jamais activé : l'alias reste sur l'ancien.
      const previous = failed === 0 ? await store.activate(opensearchIndex) : []
      opensearch = { index: opensearchIndex, previous, failed }
    }
    await this.cache.invalidate()
    return { processed, orphansDeleted, opensearch }
  }
}
