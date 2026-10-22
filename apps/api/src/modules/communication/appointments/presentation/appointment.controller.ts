import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
} from "../../../identity"
import { appointmentRateLimit } from "../../communication.config"
import { CommunicationApiErrors } from "../../presentation/communication-api-errors"
import { serialize } from "../../presentation/serialize"
import { AppointmentService } from "../application/appointment.service"
import {
  AppointmentListResponseDto,
  AppointmentQueryDto,
  AppointmentResponseDto,
  CancelVisitDto,
  RequestVisitDto,
  RescheduleVisitDto,
} from "./appointment.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const writeLimit = {
  default: { limit: appointmentRateLimit, ttl: 60_000 },
}

@ApiTags("appointments")
@ApiBearerAuth()
@Controller({ path: "appointments", version: "1" })
export class AppointmentController {
  constructor(
    private readonly actors: ActorService,
    private readonly appointments: AppointmentService,
  ) {}

  @Post()
  @Permissions("appointment:request")
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Demander une visite",
    description:
      "La visite reste PENDING jusqu'à la confirmation par l'annonceur ; jamais confirmée automatiquement. Une seule visite en cours par annonce.",
  })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 403, 404, 409, 422, 429)
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestVisitDto,
    @Client() client: ClientContext,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.appointments.request(actor, dto, client))
  }

  @Get()
  @ApiOperation({ summary: "Mes visites (demandées ou sur mes biens)" })
  @ApiOkResponse({ type: AppointmentListResponseDto })
  @CommunicationApiErrors(400, 401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AppointmentQueryDto,
  ): Promise<AppointmentListResponseDto> {
    const actor = await this.actors.resolve(user)
    return { items: serialize(await this.appointments.list(actor, query)) }
  }

  @Get(":appointmentId")
  @ApiOperation({ summary: "Détail d'une visite et actions possibles" })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", uuid) appointmentId: string,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.appointments.get(actor, appointmentId))
  }

  @Post(":appointmentId/confirm")
  @HttpCode(HttpStatus.OK)
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Confirmer",
    description:
      "Côté annonce pour une demande ; l'autre partie pour une nouvelle date proposée.",
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", uuid) appointmentId: string,
    @Client() client: ClientContext,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.appointments.confirm(actor, appointmentId, client),
    )
  }

  @Post(":appointmentId/reschedule")
  @HttpCode(HttpStatus.OK)
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Proposer une autre date",
    description: "L'autre partie doit l'accepter (confirm) ou contre-proposer.",
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409, 422)
  async reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", uuid) appointmentId: string,
    @Body() dto: RescheduleVisitDto,
    @Client() client: ClientContext,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.appointments.reschedule(
        actor,
        appointmentId,
        dto.scheduledAt,
        client,
      ),
    )
  }

  @Post(":appointmentId/cancel")
  @HttpCode(HttpStatus.OK)
  @Throttle(writeLimit)
  @ApiOperation({ summary: "Annuler (l'une ou l'autre partie)" })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", uuid) appointmentId: string,
    @Body() dto: CancelVisitDto,
    @Client() client: ClientContext,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.appointments.cancel(actor, appointmentId, dto.reason, client),
    )
  }

  @Post(":appointmentId/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Marquer la visite comme effectuée (côté annonce)" })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409)
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", uuid) appointmentId: string,
    @Client() client: ClientContext,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.appointments.complete(actor, appointmentId, client),
    )
  }

  @Post(":appointmentId/no-show")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Client absent (côté annonce, après l'heure)" })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409)
  async noShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", uuid) appointmentId: string,
    @Client() client: ClientContext,
  ): Promise<AppointmentResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.appointments.noShow(actor, appointmentId, client),
    )
  }
}
