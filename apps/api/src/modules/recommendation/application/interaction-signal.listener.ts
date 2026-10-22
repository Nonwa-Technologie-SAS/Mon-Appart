import { Injectable } from "@nestjs/common"

import { OnEvents } from "../../../common/events/on-events.decorator"
import { InteractionEvent } from "../../interaction"
import { RecommendationCache } from "../infrastructure/recommendation-cache"

/**
 * Favoris / retours d’intérêt : invalide le cache utilisateur et marque le
 * profil comportemental à reconstruire. Les vues seules ne bumpent pas le
 * cache global (pénalité légère à la prochaine lecture de profil).
 */
@Injectable()
export class InteractionSignalListener {
  constructor(private readonly cache: RecommendationCache) {}

  @OnEvents(
    [InteractionEvent.FAVORITE_ADDED, InteractionEvent.FAVORITE_REMOVED],
    { async: true, promisify: true, suppressErrors: true },
  )
  async onFavoriteChanged(event: {
    payload: { userId: string }
  }): Promise<void> {
    const userId = event.payload?.userId
    if (!userId) return
    await Promise.all([
      this.cache.bumpUser(userId),
      this.cache.markProfileDirty(userId),
    ])
  }

  @OnEvents([InteractionEvent.PROPERTY_VIEWED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async onViewed(event: {
    payload: { userId: string | null }
  }): Promise<void> {
    const userId = event.payload?.userId
    if (!userId) return
    await this.cache.markProfileDirty(userId)
  }
}
