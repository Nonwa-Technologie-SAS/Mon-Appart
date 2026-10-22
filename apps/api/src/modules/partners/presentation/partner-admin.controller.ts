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
import {
  AdminAccessGuard,
} from "../../admin/presentation/admin-access.guard"
import { CurrentUser, Permissions, type AuthenticatedUser } from "../../identity"
import { PartnerDeliveryRunner } from "../application/partner-delivery-runner"
import { PartnerImportService } from "../application/partner-import.service"
import { PartnerRegistryService } from "../application/partner-registry.service"
import {
  CreateIntegrationStubDto,
  CreatePartnerDto,
  CreateWebhookOutDto,
  SetIntegrationStatusDto,
  UpdatePartnerDto,
  ValidateCsvImportDto,
} from "./partner.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const mutation = { default: { limit: adminMutationRateLimit, ttl: 60_000 } }

@ApiTags("admin-partners")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/partners", version: "1" })
export class PartnerAdminController {
  constructor(
    private readonly registry: PartnerRegistryService,
    private readonly imports: PartnerImportService,
    private readonly runner: PartnerDeliveryRunner,
  ) {}

  @Get()
  @Permissions("partner:read")
  @ApiOperation({
    summary: "Registre des partenaires",
    description:
      "Statut commercial et intégrations techniques. Aucun secret n’est exposé.",
  })
  list(@Query("cursor") cursor?: string) {
    return this.registry.list({ cursor })
  }

  @Get(":partnerId")
  @Permissions("partner:read")
  @ApiOperation({ summary: "Détail partenaire" })
  get(@Param("partnerId", uuid) partnerId: string) {
    return this.registry.get(partnerId)
  }

  @Post()
  @Permissions("partner:manage")
  @Throttle(mutation)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Enregistrer un partenaire",
    description:
      "N’implique aucun accord commercial réel ni intégration active.",
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePartnerDto,
  ) {
    return this.registry.create(user, body)
  }

  @Patch(":partnerId")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @ApiOperation({ summary: "Mettre à jour le statut commercial / fiche" })
  update(
    @Param("partnerId", uuid) partnerId: string,
    @Body() body: UpdatePartnerDto,
  ) {
    return this.registry.updateCommercial(partnerId, body)
  }

  @Post(":partnerId/integrations/webhook-out")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer une intégration webhook sortant (HMAC)",
    description:
      "Le secret en clair n’est renvoyé qu’une fois. Requiert PARTNERS_SECRETS_KEY.",
  })
  createWebhookOut(
    @Param("partnerId", uuid) partnerId: string,
    @Body() body: CreateWebhookOutDto,
  ) {
    return this.registry.createWebhookOut(partnerId, body)
  }

  @Post(":partnerId/integrations")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Enregistrer une intégration planifiée (CSV, API…)",
  })
  createStub(
    @Param("partnerId", uuid) partnerId: string,
    @Body() body: CreateIntegrationStubDto,
  ) {
    return this.registry.createIntegrationStub(partnerId, body)
  }

  @Patch("integrations/:integrationId/status")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @ApiOperation({ summary: "Activer / suspendre une intégration" })
  setStatus(
    @Param("integrationId", uuid) integrationId: string,
    @Body() body: SetIntegrationStatusDto,
  ) {
    return this.registry.setIntegrationStatus(integrationId, body.status)
  }

  @Post(":partnerId/imports/csv/validate")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @ApiOperation({
    summary: "Valider un import CSV (dry-run)",
    description:
      "Ne crée aucune annonce. Journalise un lot avec rapport d’erreurs.",
  })
  validateCsv(
    @Param("partnerId", uuid) partnerId: string,
    @Body() body: ValidateCsvImportDto,
  ) {
    return this.imports.validateCsv(partnerId, body)
  }

  @Post("deliveries/run")
  @Permissions("partner:manage")
  @Throttle(mutation)
  @ApiOperation({
    summary: "Traiter la file de livraisons échues (manuel)",
  })
  runDeliveries() {
    return this.runner.runOnce()
  }
}
