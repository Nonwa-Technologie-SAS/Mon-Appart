import { Inject, Injectable, Optional } from "@nestjs/common"

import type { SearchEngine } from "../domain/search-engine"
import { SearchConfig } from "../search.config"
import {
  OPENSEARCH_GATEWAY,
  type OpenSearchGateway,
} from "./opensearch/opensearch.gateway"
import { OpenSearchIndexStore } from "./opensearch/opensearch-index.store"
import { OpenSearchEngine } from "./opensearch/opensearch-search.engine"
import { PostgresSearchEngine } from "./postgres/postgres-search.engine"
import { SuggestionProvider } from "./suggestion.provider"

/**
 * Choisit le moteur selon SEARCH_ENGINE. PostgreSQL est toujours construit :
 * il sert de moteur par défaut et de repli. OpenSearch n'existe que si
 * SEARCH_ENGINE=opensearch et OPENSEARCH_NODE sont renseignés.
 */
@Injectable()
export class SearchEngineFactory {
  readonly postgres: PostgresSearchEngine
  readonly opensearch: OpenSearchEngine | null
  readonly opensearchStore: OpenSearchIndexStore | null

  constructor(
    config: SearchConfig,
    postgres: PostgresSearchEngine,
    suggestions: SuggestionProvider,
    @Optional() @Inject(OPENSEARCH_GATEWAY) gateway: OpenSearchGateway | null,
  ) {
    this.postgres = postgres
    if (gateway) {
      this.opensearchStore = new OpenSearchIndexStore(
        gateway,
        config.opensearch.indexPrefix,
        config.indexVersion,
        config.synonyms,
      )
      this.opensearch =
        config.engine === "opensearch"
          ? new OpenSearchEngine(
              gateway,
              this.opensearchStore.alias,
              config.priceFacetBounds,
              suggestions,
            )
          : null
    } else {
      this.opensearchStore = null
      this.opensearch = null
    }
  }

  primary(): SearchEngine {
    return this.opensearch ?? this.postgres
  }
}
