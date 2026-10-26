import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { adminMutationRateLimit } from "../../admin/admin.config"
import { AdminAccessGuard } from "../../admin/presentation/admin-access.guard"
import {
  CurrentUser,
  Permissions,
  type AuthenticatedUser,
} from "../../identity"
import { SupplyLeadService } from "../application/supply-lead.service"
import {
  AddSupplyLeadInteractionDto,
  CreateSupplyLeadDto,
  SupplyLeadSegmentDto,
  SupplyLeadStageDto,
  UpdateSupplyLeadDto,
} from "./supply-lead.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const mutation = { default: { limit: adminMutationRateLimit, ttl: 60_000 } }

@ApiTags("admin-supply-leads")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/supply-leads", version: "1" })
export class SupplyLeadAdminController {
  constructor(private readonly supplyLeads: SupplyLeadService) {}

  @Get()
  @Permissions("partner:read")
  @ApiOperation({
    summary: "Pipeline commercial acquisition d’offre",
    description:
      "Prospects terrain (propriétaires / agences). Distinct du registre Partner. Aucun lead inventé.",
  })
  list(
    @Query("cursor") cursor?: string,
    @Query("stage") stage?: SupplyLeadStageDto,
    @Query("segment") segment?: SupplyLeadSegmentDto,
  ) {
    return this.supplyLeads.list({ cursor, stage, segment })
  }

  @Get(":leadId")
  @Permissions("partner:read")
  @ApiOperation({ summary: "Détail prospect supply + interactions" })
  get(@Param("leadId", uuid) leadId: string) {
    return this.supplyLeads.get(leadId)
  }

  @Post()
  @Permissions("partner:manage")
  @Throttle(mutation)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer un prospect supply",
    description: "Coordonnées professionnelles minimales ; pas de scraping.",
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSupplyLeadDto,
  ) {
    return this.supplyLeads.create(user, body)
  }

  @Patch(":leadId")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @ApiOperation({ summary: "Mettre à jour un prospect / stage pipeline" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leadId", uuid) leadId: string,
    @Body() body: UpdateSupplyLeadDto,
  ) {
    return this.supplyLeads.update(user, leadId, body)
  }

  @Post(":leadId/interactions")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Journaliser un contact commercial" })
  addInteraction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leadId", uuid) leadId: string,
    @Body() body: AddSupplyLeadInteractionDto,
  ) {
    return this.supplyLeads.addInteraction(user, leadId, body)
  }
}
