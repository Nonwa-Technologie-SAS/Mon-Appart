import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import { createHash, randomUUID } from "node:crypto"

import {
  Client,
  ErrorResponseDto,
  OptionalAuth,
  OptionalUser,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { AssistantService } from "../application/assistant.service"
import { aiAssistantRateLimit } from "../ai-assistant.config"
import {
  AssistantFeedbackDto,
  AssistantMessageDto,
  CompareListingsDto,
  CreateConversationResponseDto,
  NaturalSearchDto,
} from "./dto/assistant.dto"

const MINUTE_MS = 60_000
const uuid = new ParseUUIDPipe({ version: "4" })

function ApiErrors(...statuses: Array<400 | 404 | 429 | 503>) {
  const descriptions: Record<number, string> = {
    400: "Requête invalide",
    404: "Conversation introuvable",
    429: "Trop de requêtes",
    503: "Assistant désactivé ou indisponible",
  }
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: descriptions[status],
        type: ErrorResponseDto,
      }),
    ),
  )
}

function sessionKeyFrom(
  header: string | undefined,
  client: ClientContext,
  user: AuthenticatedUser | undefined,
): string {
  if (user?.id) return `user:${user.id}`
  const raw = header?.trim()
  if (raw && raw.length >= 8 && raw.length <= 128) return `anon:${raw}`
  const seed = `${client.ip ?? "0"}|${client.userAgent ?? ""}`
  return `anon:${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`
}

@ApiTags("ai-assistant")
@Controller({ path: "ai-assistant", version: "1" })
export class AiAssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post("conversations")
  @OptionalAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiHeader({
    name: "x-assistant-session",
    required: false,
    description: "Identifiant anonyme de session (UUID recommandé)",
  })
  @ApiOperation({ summary: "Créer une conversation assistant" })
  @ApiOkResponse({ type: CreateConversationResponseDto })
  @ApiErrors(429, 503)
  create(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ): CreateConversationResponseDto {
    return this.assistant.createConversation({
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    })
  }

  @Get("conversations")
  @OptionalAuth()
  @ApiBearerAuth()
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Lister mes conversations récentes" })
  @ApiErrors(429, 503)
  list(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ) {
    return this.assistant.listConversations({
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    })
  }

  @Get("conversations/:conversationId")
  @OptionalAuth()
  @ApiBearerAuth()
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Détail d’une conversation (isolation session/user)" })
  @ApiErrors(404, 429, 503)
  getOne(
    @Param("conversationId", uuid) conversationId: string,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ) {
    return this.assistant.getConversation(conversationId, {
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    })
  }

  @Delete("conversations/:conversationId")
  @OptionalAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Supprimer une conversation" })
  @ApiErrors(404, 429, 503)
  remove(
    @Param("conversationId", uuid) conversationId: string,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ) {
    return this.assistant.deleteConversation(conversationId, {
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    })
  }

  @Post("conversations/:conversationId/messages")
  @OptionalAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Envoyer un message (NLU → clarification ou Search réel)",
    description:
      "Extraction déterministe des critères, validation backend, puis Search. Aucune annonce inventée. OpenAI optionnel pour reformuler le texte uniquement.",
  })
  @ApiErrors(400, 404, 429, 503)
  message(
    @Param("conversationId", uuid) conversationId: string,
    @Body() body: AssistantMessageDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ) {
    return this.assistant.turn(conversationId, body.message, {
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    }, {
      forceSearch: body.forceSearch,
      compareListingIds: body.compareListingIds,
    })
  }

  @Post("search")
  @OptionalAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Recherche en langage naturel (crée une conversation)",
  })
  @ApiErrors(400, 429, 503)
  naturalSearch(
    @Body() body: NaturalSearchDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ) {
    return this.assistant.turn(null, body.query, {
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    }, { forceSearch: body.forceSearch })
  }

  @Post("conversations/:conversationId/compare")
  @OptionalAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Comparer des annonces déjà présentées dans la conversation",
  })
  @ApiErrors(400, 404, 429, 503)
  compare(
    @Param("conversationId", uuid) conversationId: string,
    @Body() body: CompareListingsDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
    @Headers("x-assistant-session") sessionHeader?: string,
  ) {
    return this.assistant.compare(conversationId, body.listingIds, {
      user,
      requestId: client.requestId,
      sessionKey: sessionKeyFrom(sessionHeader, client, user),
    })
  }

  @Post("feedback")
  @OptionalAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: aiAssistantRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Retour utilisateur (journalisé, sans données sensibles)",
  })
  @ApiErrors(400, 429, 503)
  feedback(@Body() body: AssistantFeedbackDto) {
    // Pas de persistance durable en V1 — acceptation pour télémétrie future.
    return {
      accepted: true,
      feedbackId: randomUUID(),
      rating: body.rating,
    }
  }
}
