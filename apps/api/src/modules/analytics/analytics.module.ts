import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { PropertyModule } from "../property/property.module"
import { AnalyticsConfig } from "./analytics.config"
import { AggregationService } from "./application/aggregation.service"
import { AnalyticsQueryService } from "./application/analytics-query.service"
import { AnalyticsTracker } from "./application/analytics-tracker"
import { AnalyticsWorker } from "./application/analytics-worker"
import { BusinessEventListener } from "./application/business-event.listener"
import { ConsentService } from "./application/consent.service"
import { IngestionStats } from "./application/ingestion-stats"
import { IngestionService } from "./application/ingestion.service"
import { RetentionService } from "./application/retention.service"
import { AnalyticsRepository } from "./infrastructure/analytics.repository"
import { BusinessFactsRepository } from "./infrastructure/business-facts.repository"
import {
  AdminAnalyticsController,
  AnalyticsController,
} from "./presentation/analytics.controller"

/**
 * Mesure d'audience et indicateurs : ingestion client consentie, événements
 * métier produits par le backend à partir des événements de domaine,
 * agrégats journaliers calculés en tâche de fond. Aucun module métier ne
 * dépend d'Analytics : une panne ici ne bloque aucune action utilisateur.
 */
@Module({
  imports: [IdentityModule, PropertyModule],
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [
    AnalyticsConfig,
    AnalyticsRepository,
    BusinessFactsRepository,
    IngestionStats,
    ConsentService,
    IngestionService,
    AnalyticsTracker,
    BusinessEventListener,
    AggregationService,
    RetentionService,
    AnalyticsWorker,
    AnalyticsQueryService,
  ],
})
export class AnalyticsModule {}
