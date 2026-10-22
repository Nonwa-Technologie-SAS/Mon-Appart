import type { ListingSearchDocument } from "../../domain/listing-search-document"
import type { SynonymMap } from "../../domain/text-normalizer"
import type { OpenSearchGateway } from "./opensearch.gateway"
import { listingIndexDefinition, toOpenSearchBody } from "./opensearch-mapping"

/**
 * Index versionnés derrière un alias : lectures et écritures passent par
 * `<prefix>_current`, une réindexation construit `<prefix>_v<N>_<horodatage>`
 * puis bascule l'alias atomiquement. L'ancien index est conservé (retour
 * arrière manuel) ; sa suppression est une opération d'exploitation.
 */
export class OpenSearchIndexStore {
  readonly alias: string
  private readyPromise: Promise<void> | null = null

  constructor(
    private readonly gateway: OpenSearchGateway,
    private readonly prefix: string,
    private readonly version: number,
    private readonly synonyms: SynonymMap,
  ) {
    this.alias = `${prefix}_current`
  }

  /** Crée l'index initial et l'alias s'ils n'existent pas. */
  async ensureIndex(): Promise<void> {
    const targets = await this.gateway.aliasTargets(this.alias)
    if (targets.length > 0) return
    const index = `${this.prefix}_v${this.version}`
    if (!(await this.gateway.indexExists(index))) {
      await this.gateway.createIndex(
        index,
        listingIndexDefinition(this.synonyms),
      )
    }
    await this.gateway.swapAlias(this.alias, [], index)
  }

  /**
   * Garantit l'index et l'alias avant toute écriture unitaire : sinon une
   * écriture sur l'alias absent créerait un index de ce nom en mapping dynamique.
   */
  private ready(): Promise<void> {
    this.readyPromise ??= this.ensureIndex().catch((error: unknown) => {
      this.readyPromise = null
      throw error
    })
    return this.readyPromise
  }

  async index(document: ListingSearchDocument): Promise<void> {
    await this.ready()
    const { failed } = await this.gateway.bulk(this.alias, [
      {
        action: "index",
        id: document.listingId,
        document: toOpenSearchBody(document),
      },
    ])
    if (failed > 0) throw new Error("indexation OpenSearch refusée")
  }

  async delete(listingId: string): Promise<void> {
    await this.ready()
    const { failed } = await this.gateway.bulk(this.alias, [
      { action: "delete", id: listingId },
    ])
    if (failed > 0) throw new Error("suppression OpenSearch refusée")
  }

  async createVersionedIndex(now = new Date()): Promise<string> {
    const stamp = now
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14)
    const index = `${this.prefix}_v${this.version}_${stamp}`
    await this.gateway.createIndex(index, listingIndexDefinition(this.synonyms))
    return index
  }

  async bulkIndex(
    index: string,
    documents: ListingSearchDocument[],
  ): Promise<number> {
    const { failed } = await this.gateway.bulk(
      index,
      documents.map((document) => ({
        action: "index" as const,
        id: document.listingId,
        document: toOpenSearchBody(document),
      })),
    )
    return failed
  }

  async activate(index: string): Promise<string[]> {
    await this.gateway.refresh(index)
    const previous = await this.gateway.aliasTargets(this.alias)
    await this.gateway.swapAlias(this.alias, previous, index)
    return previous
  }

  count(): Promise<number> {
    return this.gateway.count(this.alias)
  }
}
