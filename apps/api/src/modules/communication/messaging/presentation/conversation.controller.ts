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
import {
  DownloadLinkResponseDto,
  UploadSessionResponseDto,
  serializeLink,
  serializeSession,
} from "../../../media"
import { messagingRateLimit } from "../../communication.config"
import { CommunicationApiErrors } from "../../presentation/communication-api-errors"
import { serialize } from "../../presentation/serialize"
import { ConversationService } from "../application/conversation.service"
import { MessageService } from "../application/message.service"
import {
  ArchiveConversationDto,
  AttachmentUploadDto,
  ConversationPageResponseDto,
  ConversationQueryDto,
  ConversationResponseDto,
  ConversationUnreadResponseDto,
  MarkReadDto,
  MarkReadResponseDto,
  MessagePageResponseDto,
  MessageQueryDto,
  MuteConversationDto,
  SendMessageDto,
  SendMessageResponseDto,
  StartConversationDto,
  StartConversationResponseDto,
} from "./messaging.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000
const writeLimit = { default: { limit: messagingRateLimit, ttl: MINUTE_MS } }

@ApiTags("messaging")
@ApiBearerAuth()
@Controller({ path: "conversations", version: "1" })
export class ConversationController {
  constructor(
    private readonly actors: ActorService,
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
  ) {}

  @Post()
  @Permissions("conversation:create")
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Contacter l'annonceur d'une annonce publiée",
    description:
      "Crée la demande de contact, la conversation et le premier message ; si une conversation existe déjà avec cette annonce, le message y est ajouté (`created` = false).",
  })
  @ApiCreatedResponse({ type: StartConversationResponseDto })
  @CommunicationApiErrors(400, 401, 403, 404, 409, 422, 429)
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartConversationDto,
    @Client() client: ClientContext,
  ): Promise<StartConversationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.conversations.start(actor, dto, client))
  }

  @Get()
  @ApiOperation({
    summary: "Mes conversations (activité récente d'abord)",
    description:
      "Celles que j'ai ouvertes et celles des biens que je gère aujourd'hui.",
  })
  @ApiOkResponse({ type: ConversationPageResponseDto })
  @CommunicationApiErrors(400, 401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConversationQueryDto,
  ): Promise<ConversationPageResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.conversations.list(actor, query))
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Messages non lus, toutes conversations" })
  @ApiOkResponse({ type: ConversationUnreadResponseDto })
  @CommunicationApiErrors(401)
  async unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationUnreadResponseDto> {
    const actor = await this.actors.resolve(user)
    return { unread: await this.conversations.totalUnread(actor) }
  }

  @Get(":conversationId")
  @ApiOperation({ summary: "Détail d'une conversation" })
  @ApiOkResponse({ type: ConversationResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
  ): Promise<ConversationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.conversations.get(actor, conversationId))
  }

  @Get(":conversationId/messages")
  @ApiOperation({
    summary: "Messages d'une conversation",
    description:
      "Sans paramètre : les plus récents. `before` remonte l'historique ; `after` rattrape ce qui a été manqué (reconnexion). Lire marque les messages comme reçus.",
  })
  @ApiOkResponse({ type: MessagePageResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async messagesPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Query() query: MessageQueryDto,
  ): Promise<MessagePageResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.messages.list(actor, conversationId, query))
  }

  @Post(":conversationId/messages")
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Envoyer un message",
    description:
      "Le message est enregistré avant toute diffusion ; un échec d'e-mail ou de SMS ne l'affecte pas. `clientMessageId` rend le renvoi idempotent.",
  })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409, 422, 429)
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Body() dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.messages.send(actor, conversationId, dto))
  }

  @Post(":conversationId/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Marquer la conversation comme lue" })
  @ApiOkResponse({ type: MarkReadResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Body() dto: MarkReadDto,
  ): Promise<MarkReadResponseDto> {
    const actor = await this.actors.resolve(user)
    return this.messages.markRead(actor, conversationId, dto.upToSeq)
  }

  @Patch(":conversationId/archive")
  @ApiOperation({
    summary: "Archiver ou désarchiver (pour moi seulement)",
    description: "Un nouveau message désarchive la conversation.",
  })
  @ApiOkResponse({ type: ConversationResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Body() dto: ArchiveConversationDto,
  ): Promise<ConversationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.conversations.setArchived(actor, conversationId, dto.archived),
    )
  }

  @Patch(":conversationId/mute")
  @ApiOperation({
    summary: "Couper les notifications externes de la conversation",
  })
  @ApiOkResponse({ type: ConversationResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async mute(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Body() dto: MuteConversationDto,
  ): Promise<ConversationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.conversations.setMuted(actor, conversationId, dto.muted),
    )
  }

  @Post(":conversationId/attachments")
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Préparer l'envoi d'une pièce jointe",
    description:
      "Renvoie une URL d'envoi direct vers le stockage privé. Terminer par POST /media/upload-sessions/:sessionId/complete, puis citer `mediaId` dans `attachmentIds` du message.",
  })
  @ApiCreatedResponse({ type: UploadSessionResponseDto })
  @CommunicationApiErrors(400, 401, 404, 409, 422, 429)
  async attachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Body() dto: AttachmentUploadDto,
    @Client() client: ClientContext,
  ): Promise<UploadSessionResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeSession(
      await this.conversations.startAttachmentUpload(
        actor,
        conversationId,
        dto,
        client,
      ),
    )
  }

  @Get(":conversationId/messages/:messageId/attachments/:attachmentId")
  @ApiOperation({
    summary: "Lien de lecture court d'une pièce jointe",
    description:
      "Réservé aux participants ; URL signée de courte durée, chaque accès est audité.",
  })
  @ApiOkResponse({ type: DownloadLinkResponseDto })
  @CommunicationApiErrors(400, 401, 404)
  async attachmentLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", uuid) conversationId: string,
    @Param("messageId", uuid) messageId: string,
    @Param("attachmentId", uuid) attachmentId: string,
    @Client() client: ClientContext,
  ): Promise<DownloadLinkResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeLink(
      await this.conversations.attachmentLink(
        actor,
        conversationId,
        messageId,
        attachmentId,
        client,
      ),
    )
  }
}
