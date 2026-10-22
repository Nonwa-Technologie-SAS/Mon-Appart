import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { PropertyModule } from "../property/property.module"
import { SearchHistoryService } from "./application/search-history.service"
import { SearchIndexer } from "./application/search-indexer"
import { SearchReindexService } from "./application/search-reindex.service"
import { SearchService } from "./application/search.service"
import {
  createOpenSearchGateway,
  OPENSEARCH_GATEWAY,
} from "./infrastructure/opensearch/opensearch.gateway"
import { ListingCandidateSource } from "./infrastructure/postgres/listing-candidate.source"
import { PostgresIndexStore } from "./infrastructure/postgres/postgres-index.store"
import { PostgresSearchEngine } from "./infrastructure/postgres/postgres-search.engine"
import { SearchHydrator } from "./infrastructure/postgres/search-hydrator"
import { SearchSourceRepository } from "./infrastructure/postgres/search-source.repository"
import { SearchCache } from "./infrastructure/search-cache"
import { SearchEngineFactory } from "./infrastructure/search-engine.factory"
import { SuggestionProvider } from "./infrastructure/suggestion.provider"
import { SearchHealthController } from "./presentation/search-health.controller"
import { SearchController } from "./presentation/search.controller"
import { SearchConfig } from "./search.config"

/**
 * Search & Discovery. Consomme Property et Listing en lecture et via leurs
 * événements ; aucun module métier ne dépend de Search ni d'OpenSearch.
 */
@Module({
  imports: [IdentityModule, PropertyModule],
  controllers: [SearchController, SearchHealthController],
  providers: [
    SearchConfig,
    {
      provide: OPENSEARCH_GATEWAY,
      inject: [SearchConfig],
      useFactory: createOpenSearchGateway,
    },
    SuggestionProvider,
    PostgresSearchEngine,
    SearchEngineFactory,
    SearchHydrator,
    ListingCandidateSource,
    SearchSourceRepository,
    PostgresIndexStore,
    SearchCache,
    SearchHistoryService,
    SearchIndexer,
    SearchReindexService,
    SearchService,
  ],
  exports: [
    SearchService,
    SearchIndexer,
    SearchReindexService,
    ListingCandidateSource,
    SearchHydrator,
  ],
})
export class SearchModule {}

