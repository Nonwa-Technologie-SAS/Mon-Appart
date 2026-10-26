import { Injectable, Logger } from "@nestjs/common"
import type { DomainEvent } from "../../../common/events/domain-event"
import { InboxService } from "../../../common/events/inbox.service"
import { OnEvents } from "../../../common/events/on-events.decorator"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { MetricsService } from "../../../observability/metrics.service"
import { buildListingSearchDocument } from "../domain/listing-search-document"
import { PostgresIndexStore } from "../infrastructure/postgres/postgres-index.store"
import { SearchSourceRepository } from "../infrastructure/postgres/search-source.repository"
import { SearchCache } from "../infrastructure/search-cache"
import { SearchEngineFactory } from "../infrastructure/search-engine.factory"
import { SuggestionProvider } from "../infrastructure/suggestion.provider"

const LISTING_EVENTS = [
  "listing.created",
  "listing.updated",
  "listing.published",
  "listing.paused",
  "listing.expired",
  "listing.sold",
  "listing.rented",
  "listing.status_changed",
  "listing.price_changed",
  "listing.deleted",
]

/** `property.media_changed` : image principale ou nombre de médias, annonces du bien seulement. */
const PROPERTY_EVENTS = [
  "property.updated",
  "property.deleted",
  "property.media_changed",
]

/**
 * Maintient les index de recherche à partir des tables métier. Chaque
 * synchronisation relit l'état courant : rejouer ou réordonner des événements
 * converge vers le même document (idempotence). Les erreurs sont journalisées
 * et mesurées, jamais propagées à l'opération métier ; `search:reindex`
 * rattrape un index en retard.
 */
@Injectable()
export class SearchIndexer {
  private readonly logger = new Logger(SearchIndexer.name)
  /** Sérialise les synchronisations d'une même annonce dans ce processus. */
  private readonly queues = new Map<string, Promise<void>>()

  constructor(
    private readonly source: SearchSourceRepository,
    private readonly postgres: PostgresIndexStore,
    private readonly engines: SearchEngineFactory,
    private readonly cache: SearchCache,
    private readonly suggestions: SuggestionProvider,
    private readonly metrics: MetricsService,
    private readonly inbox: InboxService,
  ) {}

  @OnEvents(LISTING_EVENTS, {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onListingEvent(event: DomainEvent<object>): Promise<void> {
    if (await this.seen("search.indexer", event.id)) return
    await this.syncListing(event.aggregateId)
    await this.remember("search.indexer", event.id, event.name)
  }

  @OnEvents(PROPERTY_EVENTS, {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onPropertyEvent(event: DomainEvent<object>): Promise<void> {
    if (await this.seen("search.indexer", event.id)) return
    await this.syncProperty(event.aggregateId)
    await this.remember("search.indexer", event.id, event.name)
  }

  private async seen(consumer: string, eventId: string): Promise<boolean> {
    if (await this.inbox.alreadyProcessed(consumer, eventId)) {
      this.metrics.outbox.deduplicated.inc({ consumer })
      return true
    }
    return false
  }

  private async remember(
    consumer: string,
    eventId: string,
    eventType: string,
  ): Promise<void> {
    await this.inbox.claim(consumer, eventId)
    this.metrics.outbox.consumed.inc({
      consumer,
      event_type: eventType.split(".").slice(0, 2).join("."),
    })
  }

  /** Indexe ou retire une annonce selon son état actuel en base. */
  syncListing(listingPublicId: string): Promise<void> {
    const previous = this.queues.get(listingPublicId) ?? Promise.resolve()
    const next = previous
      .then(() => this.doSyncListing(listingPublicId))
      .finally(() => {
        if (this.queues.get(listingPublicId) === next) {
          this.queues.delete(listingPublicId)
        }
      })
    this.queues.set(listingPublicId, next)
    return next
  }

  async syncProperty(propertyPublicId: string): Promise<void> {
    try {
      const listingIds =
        await this.source.listingPublicIdsOfProperty(propertyPublicId)
      for (const listingId of listingIds) await this.syncListing(listingId)
    } catch (error) {
      this.fail("postgres", error)
    }
  }

  private async doSyncListing(listingPublicId: string): Promise<void> {
    let indexable
    try {
      indexable = await this.source.byListingPublicId(listingPublicId)
      if (indexable) {
        await this.postgres.upsert(
          indexable.internalId,
          buildListingSearchDocument(indexable.source),
        )
        this.metrics.search.indexing.inc({
          target: "postgres",
          operation: "index",
        })
      } else {
        await this.postgres.deleteByPublicId(listingPublicId)
        this.metrics.search.indexing.inc({
          target: "postgres",
          operation: "delete",
        })
      }
    } catch (error) {
      this.fail("postgres", error)
      return
    } finally {
      await this.cache.invalidate()
      this.suggestions.invalidate()
    }

    const store = this.engines.opensearchStore
    if (!store) return
    try {
      if (indexable) {
        await store.index(buildListingSearchDocument(indexable.source))
        this.metrics.search.indexing.inc({
          target: "opensearch",
          operation: "index",
        })
      } else {
        await store.delete(listingPublicId)
        this.metrics.search.indexing.inc({
          target: "opensearch",
          operation: "delete",
        })
      }
    } catch (error) {
      this.metrics.search.opensearchErrors.inc({ operation: "index" })
      this.fail("opensearch", error)
    }
  }

  private fail(target: "postgres" | "opensearch", error: unknown): void {
    this.metrics.search.indexingFailures.inc({ target })
    this.logger.error(
      JSON.stringify({
        action: "search_indexing_failed",
        target,
        error: safeErrorMessage(error),
      }),
    )
  }
}
