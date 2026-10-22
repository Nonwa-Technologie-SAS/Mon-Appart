import { Client } from "@opensearch-project/opensearch"

import type { SearchConfig } from "../../search.config"

export const OPENSEARCH_GATEWAY = Symbol("OPENSEARCH_GATEWAY")

export interface OpenSearchHit {
  _id: string
  _score: number | null
  sort?: Array<string | number>
}

export interface OpenSearchSearchResponse {
  hits: { total?: { value: number; relation: string }; hits: OpenSearchHit[] }
  aggregations?: Record<string, unknown>
}

export interface BulkOperation {
  action: "index" | "delete"
  id: string
  document?: Record<string, unknown>
}

/**
 * Sous-ensemble du client OpenSearch utilisé par le module. Les corps de
 * requête sont toujours construits côté serveur (OpenSearchQueryBuilder) ;
 * aucune requête DSL ne vient du client HTTP.
 */
export interface OpenSearchGateway {
  search(
    index: string,
    body: Record<string, unknown>,
  ): Promise<OpenSearchSearchResponse>
  bulk(index: string, operations: BulkOperation[]): Promise<{ failed: number }>
  indexExists(index: string): Promise<boolean>
  createIndex(index: string, body: Record<string, unknown>): Promise<void>
  aliasTargets(alias: string): Promise<string[]>
  swapAlias(alias: string, from: string[], to: string): Promise<void>
  refresh(index: string): Promise<void>
  count(index: string): Promise<number>
  clusterHealth(): Promise<string>
}

/** Erreur réseau ou délai dépassé : déclenche le repli PostgreSQL. */
export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || /timeout/i.test(error.message))
  )
}

/** `null` si OpenSearch n'est pas configuré (mode PostgreSQL seul). */
export function createOpenSearchGateway(
  config: SearchConfig,
): OpenSearchGateway | null {
  const settings = config.opensearch
  if (!settings.node) return null
  const client = new Client({
    node: settings.node,
    auth:
      settings.username && settings.password
        ? { username: settings.username, password: settings.password }
        : undefined,
    requestTimeout: settings.timeoutMs,
    maxRetries: settings.maxRetries,
  })
  return new OfficialClientGateway(client)
}

class OfficialClientGateway implements OpenSearchGateway {
  constructor(private readonly client: Client) {}

  async search(index: string, body: Record<string, unknown>) {
    const response = await this.client.search({ index, body } as never)
    return response.body as unknown as OpenSearchSearchResponse
  }

  async bulk(index: string, operations: BulkOperation[]) {
    if (operations.length === 0) return { failed: 0 }
    const body = operations.flatMap((operation) =>
      operation.action === "index"
        ? [{ index: { _index: index, _id: operation.id } }, operation.document]
        : [{ delete: { _index: index, _id: operation.id } }],
    )
    const response = await this.client.bulk({ body } as never)
    const result = response.body as unknown as {
      errors: boolean
      items: Array<Record<string, { status: number }>>
    }
    if (!result.errors) return { failed: 0 }
    // Un delete d'un document absent (404) n'est pas un échec : idempotence.
    const failed = result.items.filter((item) =>
      Object.values(item).some(
        (entry) => entry.status >= 300 && entry.status !== 404,
      ),
    ).length
    return { failed }
  }

  async indexExists(index: string) {
    const response = await this.client.indices.exists({ index } as never)
    return Boolean(response.body)
  }

  async createIndex(index: string, body: Record<string, unknown>) {
    await this.client.indices.create({ index, body } as never)
  }

  async aliasTargets(alias: string) {
    try {
      const response = await this.client.indices.getAlias({
        name: alias,
      } as never)
      return Object.keys(response.body as object)
    } catch (error) {
      if (
        (error as { meta?: { statusCode?: number } }).meta?.statusCode === 404
      ) {
        return []
      }
      throw error
    }
  }

  async swapAlias(alias: string, from: string[], to: string) {
    const actions = [
      ...from.map((index) => ({ remove: { index, alias } })),
      { add: { index: to, alias } },
    ]
    await this.client.indices.updateAliases({ body: { actions } } as never)
  }

  async refresh(index: string) {
    await this.client.indices.refresh({ index } as never)
  }

  async count(index: string) {
    const response = await this.client.count({ index } as never)
    return (response.body as { count: number }).count
  }

  async clusterHealth() {
    const response = await this.client.cluster.health({} as never)
    return (response.body as { status: string }).status
  }
}
