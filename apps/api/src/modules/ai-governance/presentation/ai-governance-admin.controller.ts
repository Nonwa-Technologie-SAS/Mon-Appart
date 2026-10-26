import { Controller, Get, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"

import { AdminAccessGuard } from "../../admin/presentation/admin-access.guard"
import { Permissions } from "../../identity"
import { AiGovernanceService } from "../application/ai-governance.service"

@ApiTags("admin-ai")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/ai", version: "1" })
export class AiGovernanceAdminController {
  constructor(private readonly governance: AiGovernanceService) {}

  @Get("overview")
  @Permissions("ai:admin")
  @ApiOperation({
    summary: "Portefeuille des systèmes IA",
    description:
      "Inventaire réel, flags runtime, versions. Aucune métrique fictive.",
  })
  overview() {
    return this.governance.overview()
  }

  @Get("eval")
  @Permissions("ai:admin")
  @ApiOperation({
    summary: "Évaluation hors ligne du moteur de recommandation",
    description:
      "Jeu synthétique versionné. Ne pas interpréter comme une perf production.",
  })
  eval() {
    return this.governance.evaluateRecommendations()
  }
}
