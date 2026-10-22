import { Injectable, type OnModuleDestroy } from "@nestjs/common"
import { OnEvents } from "../../../common/events/on-events.decorator"
import { RecommendationCache } from "../infrastructure/recommendation-cache"

const INVALIDATING_EVENTS = [
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
  "property.updated",
  "property.deleted",
  "property.media_changed",
]

/** Rafale d'événements (import, modération) : une seule invalidation. */
export const INVALIDATION_DEBOUNCE_MS = 1_000

/**
 * Rend obsolètes les listes en cache quand le catalogue change. Rien n'est
 * recalculé ici : la liste suivante est calculée à la demande. Idempotent :
 * un événement rejoué ne fait qu'incrémenter un compteur de génération.
 */
@Injectable()
export class RecommendationInvalidationListener implements OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly cache: RecommendationCache) {}

  @OnEvents(INVALIDATING_EVENTS, {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  onCatalogChange(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      void this.flush()
    }, INVALIDATION_DEBOUNCE_MS)
    this.timer.unref()
  }

  /** Applique tout de suite une invalidation en attente. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.cache.bumpGeneration()
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
