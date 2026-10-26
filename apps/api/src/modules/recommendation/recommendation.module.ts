import { Module } from "@nestjs/common"

import { MetricsService } from "../../observability/metrics.service"
import { IdentityModule } from "../identity/identity.module"
import { PropertyModule } from "../property/property.module"
import { SearchModule } from "../search/search.module"
import { BehaviorProfileService } from "./application/behavior-profile.service"
import { InteractionSignalListener } from "./application/interaction-signal.listener"
import { PreferenceService } from "./application/preference.service"
import { RecommendationInvalidationListener } from "./application/recommendation-invalidation.listener"
import { RecommendationRanker } from "./application/recommendation-ranker"
import { RecommendationService } from "./application/recommendation.service"
import { BehaviorRepository } from "./infrastructure/behavior.repository"
import { PreferenceRepository } from "./infrastructure/preference.repository"
import { RecommendationCache } from "./infrastructure/recommendation-cache"
import { RecommendationRepository } from "./infrastructure/recommendation.repository"
import { RemoteRecommendationEngine } from "./infrastructure/remote-recommendation.engine"
import { RecommendationController } from "./presentation/recommendation.controller"
import { RecommendationConfig } from "./recommendation.config"

/**
 * Recommandations. Moteur à règles en processus ; le service Python
 * (`services/recommendation`) n'est qu'une option avec repli. Lit Search
 * (candidats, cartes d'annonces) et le référentiel Property ; aucun module
 * métier ne dépend de Recommendation.
 */
@Module({
  imports: [IdentityModule, PropertyModule, SearchModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationConfig,
    {
      provide: RecommendationRanker,
      inject: [RecommendationConfig, MetricsService],
      useFactory: (config: RecommendationConfig, metrics: MetricsService) => {
        const remoteEngine = config.remote.url
          ? new RemoteRecommendationEngine(
              config.remote.url,
              config.remote.timeoutMs,
            )
          : null
        return new RecommendationRanker(
          config.engine === "remote" ? remoteEngine : null,
          metrics,
          config.shadowRemote ? remoteEngine : null,
        )
      },
    },
    PreferenceRepository,
    BehaviorRepository,
    RecommendationRepository,
    RecommendationCache,
    PreferenceService,
    BehaviorProfileService,
    RecommendationService,
    RecommendationInvalidationListener,
    InteractionSignalListener,
  ],
})
export class RecommendationModule {}
