import { Injectable, Logger } from "@nestjs/common"

import { MetricsService } from "../../../observability/metrics.service"
import {
  buildBehaviorProfile,
  parseBehaviorSignals,
} from "../domain/behavior-profile"
import {
  isEmptyBehavior,
  type BehaviorSignals,
} from "../domain/recommendation-input"
import { BehaviorRepository } from "../infrastructure/behavior.repository"
import { RecommendationCache } from "../infrastructure/recommendation-cache"
import { RecommendationConfig } from "../recommendation.config"

/**
 * Profil comportemental, recalculé paresseusement : à la lecture, s'il est
 * absent, plus vieux que `RECOMMENDATION_PROFILE_MAX_AGE_MINUTES` ou marqué
 * obsolète par un retour. L'âge maximal joue le rôle d'anti-rebond.
 */
@Injectable()
export class BehaviorProfileService {
  private readonly logger = new Logger(BehaviorProfileService.name)

  constructor(
    private readonly repository: BehaviorRepository,
    private readonly cache: RecommendationCache,
    private readonly config: RecommendationConfig,
    private readonly metrics: MetricsService,
  ) {}

  async signals(
    userId: bigint,
    userPublicId: string,
    asOf: Date,
  ): Promise<BehaviorSignals | null> {
    if (!this.config.behavior.enabled) return null
    const [stored, dirty] = await Promise.all([
      this.repository.profile(userId),
      this.cache.isProfileDirty(userPublicId),
    ])
    const maxAgeMs = this.config.behavior.profileMaxAgeMinutes * 60_000
    if (
      stored &&
      !dirty &&
      asOf.getTime() - stored.updatedAt.getTime() < maxAgeMs
    ) {
      const signals = parseBehaviorSignals(stored.row)
      return isEmptyBehavior(signals) ? null : signals
    }
    try {
      return await this.rebuild(userId, userPublicId, asOf)
    } catch (error) {
      // Profil indisponible : on recommande sans lui plutôt que d'échouer.
      this.metrics.recommendation.profileRebuilds.inc({ outcome: "error" })
      this.logger.warn(
        JSON.stringify({
          action: "behavior_profile_rebuild_failed",
          error: error instanceof Error ? error.name : "unknown",
        }),
      )
      if (!stored) return null
      const signals = parseBehaviorSignals(stored.row)
      return isEmptyBehavior(signals) ? null : signals
    }
  }

  /**
   * Supprime le profil comportemental inféré. Les préférences déclarées
   * restent ; le prochain classement repasse en GENERIC/PREFERENCES.
   */
  async clearInferred(
    userId: bigint,
    userPublicId: string,
  ): Promise<{ cleared: boolean }> {
    const cleared = await this.repository.clearProfile(userId)
    await Promise.all([
      this.cache.bumpUser(userPublicId),
      this.cache.markProfileDirty(userPublicId),
    ])
    return { cleared }
  }

  private async rebuild(
    userId: bigint,
    userPublicId: string,
    asOf: Date,
  ): Promise<BehaviorSignals | null> {
    const { lookbackDays, halfLifeDays } = this.config.behavior
    const since = new Date(asOf.getTime() - lookbackDays * 86_400_000)
    const events = await this.repository.signals(userId, since)
    const profile = buildBehaviorProfile(events, {
      asOf,
      lookbackDays,
      halfLifeDays,
    })
    await this.repository.saveProfile(userId, profile.signals)
    await this.cache.clearProfileDirty(userPublicId)
    this.metrics.recommendation.profileRebuilds.inc({
      outcome: profile.signalCount > 0 ? "built" : "empty",
    })
    return isEmptyBehavior(profile.signals) ? null : profile.signals
  }
}
