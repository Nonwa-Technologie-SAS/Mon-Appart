export { SearchModule } from "./search.module"
export { SearchService } from "./application/search.service"
export { SearchIndexer } from "./application/search-indexer"
export { SearchReindexService } from "./application/search-reindex.service"
export {
  ListingCandidateSource,
  type CandidateCriteria,
  type ListingCandidate,
} from "./infrastructure/postgres/listing-candidate.source"
export { SearchHydrator } from "./infrastructure/postgres/search-hydrator"
export type { EngineHit } from "./domain/search-engine"
export { SearchResultItemDto } from "./presentation/dto/search-response.dto"
export {
  SEARCH_PERFORMED_EVENT,
  type SearchPerformedPayload,
} from "./application/search.service"
