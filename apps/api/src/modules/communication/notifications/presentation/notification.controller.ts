import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import {
  ActorService,
  Client,
  CurrentUser,
  type AuthenticatedUser,
  type ClientContext,
} from "../../../identity"
import { CommunicationApiErrors } from "../../presentation/communication-api-errors"
import { serialize } from "../../presentation/serialize"
import { NotificationService } from "../application/notification.service"
import { PreferenceService } from "../application/preference.service"
import { PushDeviceService } from "../application/push-device.service"
import {
  MarkAllReadResponseDto,
  NotificationPageResponseDto,
  NotificationQueryDto,
  NotificationResponseDto,
  PreferencesResponseDto,
  PushDeviceListResponseDto,
  PushDeviceResponseDto,
  RegisterPushDeviceDto,
  UnreadCountResponseDto,
  UpdatePreferencesDto,
} from "./notification.dto"

const uuid = new ParseUUIDPipe({ version: "4" })

@ApiTags("notifications")
@ApiBearerAuth()
@Controller({ path: "notifications", version: "1" })
export class NotificationController {
  constructor(
    private readonly actors: ActorService,
    private readonly notifications: NotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Mes notifications (récentes d'abord)" })
  @ApiOkResponse({ type: NotificationPageResponseDto })
  @CommunicationApiErrors(400, 401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationPageResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.notifications.list(actor.userId, query))
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Nombre de notifications non lues" })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @CommunicationApiErrors(401)
  async unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResponseDto> {
    const actor = await this.actors.resolve(user)
    return { unread: await this.notifications.unreadCount(actor.userId) }
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Marquer toutes mes notifications comme lues" })
  @ApiOkResponse({ type: MarkAllReadResponseDto })
  @CommunicationApiErrors(401)
  async readAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarkAllReadResponseDto> {
    const actor = await this.actors.resolve(user)
    return { updated: await this.notifications.markAllRead(actor.userId) }
  }

  @Patch(":notificationId/read")
  @ApiOperation({ summary: "Marquer une notification comme lue" })
  @ApiOkResponse({ type: NotificationResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  patchRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("notificationId", uuid) notificationId: string,
  ): Promise<NotificationResponseDto> {
    return this.markRead(user, notificationId)
  }

  /** Conservée pour les clients existants ; équivalente au PATCH. */
  @Post(":notificationId/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Marquer une notification comme lue (alias de PATCH)",
    deprecated: true,
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  postRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("notificationId", uuid) notificationId: string,
  ): Promise<NotificationResponseDto> {
    return this.markRead(user, notificationId)
  }

  private async markRead(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.notifications.markRead(actor.userId, notificationId),
    )
  }
}

@ApiTags("notifications")
@ApiBearerAuth()
@Controller({ path: "notification-preferences", version: "1" })
export class NotificationPreferenceController {
  constructor(
    private readonly actors: ActorService,
    private readonly preferences: PreferenceService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Mes préférences de notification (catégorie × canal)",
    description:
      "`available` indique si le canal est configuré sur cette instance ; un canal indisponible n'est jamais utilisé, même activé.",
  })
  @ApiOkResponse({ type: PreferencesResponseDto })
  @CommunicationApiErrors(401)
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreferencesResponseDto> {
    const actor = await this.actors.resolve(user)
    return { items: await this.preferences.matrix(actor.userId) }
  }

  @Put()
  @ApiOperation({
    summary: "Modifier mes préférences",
    description:
      "Seules les cellules listées changent. Les notifications in-app et les e-mails de sécurité du compte ne peuvent pas être désactivés.",
  })
  @ApiOkResponse({ type: PreferencesResponseDto })
  @CommunicationApiErrors(400, 401, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
    @Client() client: ClientContext,
  ): Promise<PreferencesResponseDto> {
    const actor = await this.actors.resolve(user)
    return {
      items: await this.preferences.update(actor, dto.items, client),
    }
  }
}

@ApiTags("notifications")
@ApiBearerAuth()
@Controller({ path: "push-devices", version: "1" })
export class PushDeviceController {
  constructor(
    private readonly actors: ActorService,
    private readonly devices: PushDeviceService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Mes appareils enregistrés pour le push" })
  @ApiOkResponse({ type: PushDeviceListResponseDto })
  @CommunicationApiErrors(401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PushDeviceListResponseDto> {
    const actor = await this.actors.resolve(user)
    return { items: serialize(await this.devices.list(actor)) }
  }

  @Post()
  @ApiOperation({
    summary: "Enregistrer le jeton push de cet appareil",
    description:
      "Préparation du push Flutter : aucun envoi tant qu'aucun fournisseur push n'est configuré (`available` = false dans les préférences).",
  })
  @ApiCreatedResponse({ type: PushDeviceResponseDto })
  @CommunicationApiErrors(400, 401)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushDeviceDto,
    @Client() client: ClientContext,
  ): Promise<PushDeviceResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.devices.register(actor, dto, client))
  }

  @Delete(":deviceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Retirer un appareil (déconnexion de l'app)" })
  @ApiNoContentResponse()
  @CommunicationApiErrors(400, 401, 404)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("deviceId", uuid) deviceId: string,
    @Client() client: ClientContext,
  ): Promise<void> {
    const actor = await this.actors.resolve(user)
    await this.devices.remove(actor, deviceId, client)
  }
}
