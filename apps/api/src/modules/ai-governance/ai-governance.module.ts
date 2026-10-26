import { Module } from "@nestjs/common"

import { AdminAccessGuard } from "../admin/presentation/admin-access.guard"
import { AiAssistantConfig } from "../ai-assistant/ai-assistant.config"
import { IdentityModule } from "../identity"
import { RecommendationConfig } from "../recommendation/recommendation.config"
import { AiGovernanceService } from "./application/ai-governance.service"
import { AiGovernanceAdminController } from "./presentation/ai-governance-admin.controller"

@Module({
  imports: [IdentityModule],
  controllers: [AiGovernanceAdminController],
  providers: [
    AdminAccessGuard,
    RecommendationConfig,
    AiAssistantConfig,
    AiGovernanceService,
  ],
})
export class AiGovernanceModule {}
