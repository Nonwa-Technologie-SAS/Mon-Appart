import { Module } from "@nestjs/common"

import { CommunicationModule } from "../communication/communication.module"
import { IdentityModule } from "../identity/identity.module"
import { ListingModule } from "../listing/listing.module"
import { MediaModule } from "../media/media.module"
import { PropertyModule } from "../property/property.module"
import { BadgeService } from "./application/badge.service"
import { PrecheckService } from "./application/precheck.service"
import { ReportService } from "./application/report.service"
import { ReviewService } from "./application/review.service"
import { SignalService } from "./application/signal.service"
import { TrustActivity } from "./application/trust-activity"
import { TrustMaintenanceService } from "./application/trust-maintenance.service"
import { TrustScoreService } from "./application/trust-score.service"
import { VerificationService } from "./application/verification.service"
import { TrustRepository } from "./infrastructure/trust.repository"
import { BadgeController } from "./presentation/badge.controller"
import {
  ConversationReportController,
  ReportController,
} from "./presentation/report.controller"
import { TrustAdminController } from "./presentation/trust-admin.controller"
import { VerificationController } from "./presentation/verification.controller"
import { TrustConfig } from "./trust.config"

/**
 * Vérifications (dossiers, pièces privées, décisions humaines tracées),
 * signalements, alertes de risque, score interne et badges publics factuels.
 * Les pièces restent dans Media (portée VERIFICATION, privées) ; Trust ne
 * stocke que leur rattachement au dossier.
 */
@Module({
  imports: [
    IdentityModule,
    PropertyModule,
    ListingModule,
    MediaModule,
    CommunicationModule,
  ],
  controllers: [
    VerificationController,
    ReportController,
    ConversationReportController,
    BadgeController,
    TrustAdminController,
  ],
  providers: [
    TrustConfig,
    TrustRepository,
    TrustActivity,
    PrecheckService,
    VerificationService,
    ReviewService,
    ReportService,
    SignalService,
    TrustScoreService,
    BadgeService,
    TrustMaintenanceService,
  ],
  exports: [TrustMaintenanceService, TrustScoreService],
})
export class TrustModule {}
