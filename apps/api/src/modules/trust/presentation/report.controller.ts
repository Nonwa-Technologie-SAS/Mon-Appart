import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ActorService,
  Client,
  CurrentUser,
  Permissions,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { ReportService } from "../application/report.service"
import { trustReportRateLimit } from "../trust.config"
import { ConversationReportDto, CreateReportDto } from "./dto/trust-request.dto"
import {
  OwnReportListResponseDto,
  OwnReportResponseDto,
} from "./dto/trust-response.dto"
import { TrustApiErrors } from "./trust-api-errors"
import { serialize } from "./trust.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000

@ApiTags("trust")
@ApiBearerAuth()
@Controller({ path: "trust/reports", version: "1" })
export class ReportController {
  constructor(
    private readonly actors: ActorService,
    private readonly reports: ReportService,
  ) {}

  @Post()
  @Permissions("report:create")
  @Throttle({ default: { limit: trustReportRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Signaler une annonce ou un utilisateur",
    description:
      "Un signalement est examiné par un modérateur ; il ne suspend rien automatiquement. Un seul signalement ouvert par cible, limite quotidienne par compte.",
  })
  @ApiCreatedResponse({ type: OwnReportResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
    @Client() client: ClientContext,
  ): Promise<OwnReportResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reports.create(actor, dto, client))
  }

  @Get()
  @ApiOperation({ summary: "Mes signalements" })
  @ApiOkResponse({ type: OwnReportListResponseDto })
  @TrustApiErrors(401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OwnReportListResponseDto> {
    const actor = await this.actors.resolve(user)
    return { items: serialize(await this.reports.listOwn(actor)) }
  }

  @Get(":reportId")
  @ApiOperation({ summary: "Avancement d'un de mes signalements" })
  @ApiOkResponse({ type: OwnReportResponseDto })
  @TrustApiErrors(400, 401, 404)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("reportId", uuid) reportId: string,
  ): Promise<OwnReportResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reports.getOwn(actor, reportId))
  }
}

@ApiTags("trust")
@ApiBearerAuth()
@Controller({ path: "conversations", version: "1" })
export class ConversationReportController {
  constructor(
    private readonly actors: ActorService,
    private readonly reports: ReportService,
  ) {}

  @Post(":conversationId/report")
  @Permissions("report:create")
  @Throttle({ default: { limit: trustReportRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Signaler une conversation ou l'un de ses messages",
    description:
      "Réservé aux participants. Le modérateur ne voit que le message signalé, ou les derniers messages de la conversation ; rien n'est fermé automatiquement.",
  })
  @ApiCreatedResponse({ type: OwnReportResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Body() dto: ConversationReportDto,
    @Client() client: ClientContext,
  ): Promise<OwnReportResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reports.create(
        actor,
        {
          targetType: dto.messageId ? "MESSAGE" : "CONVERSATION",
          conversationId,
          messageId: dto.messageId,
          reason: dto.reason,
          description: dto.description,
        },
        client,
      ),
    )
  }
}
