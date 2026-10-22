import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { UploadService } from "../application/upload.service"
import { mediaUploadRateLimit } from "../media.config"
import { CreateUploadSessionDto } from "./dto/media-request.dto"
import { UploadSessionResponseDto } from "./dto/media-response.dto"
import { MediaApiErrors } from "./media-api-errors"
import { serializeSession } from "./media.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000

@ApiTags("media")
@ApiBearerAuth()
@Controller({ path: "media/upload-sessions", version: "1" })
export class MediaUploadController {
  constructor(
    private readonly actors: ActorService,
    private readonly uploads: UploadService,
  ) {}

  @Post()
  @Throttle({ default: { limit: mediaUploadRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Ouvrir une session d'envoi",
    description:
      "Réservé aux gestionnaires du bien. Renvoie une URL d'envoi direct (PUT) limitée en durée, type, taille exacte et clé, sans écrasement possible. La clé de stockage est générée par le serveur.",
  })
  @ApiCreatedResponse({ type: UploadSessionResponseDto })
  @MediaApiErrors(400, 401, 403, 404, 409, 413, 415, 429, 503)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadSessionDto,
    @Client() client: ClientContext,
  ): Promise<UploadSessionResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeSession(
      await this.uploads.createSession(actor, dto, client),
    )
  }

  @Get(":sessionId")
  @ApiOperation({
    summary: "État d'une session d'envoi",
    description: "Auteur de l'envoi ou gestionnaire du bien ; 404 sinon.",
  })
  @ApiOkResponse({ type: UploadSessionResponseDto })
  @MediaApiErrors(400, 401, 404)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId", uuid) sessionId: string,
  ): Promise<UploadSessionResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeSession(await this.uploads.getSession(actor, sessionId))
  }

  @Post(":sessionId/complete")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: mediaUploadRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Confirmer un envoi",
    description:
      "Idempotent. Vérifie l'objet réellement stocké (présence, taille exacte, signature binaire) puis le met en file de traitement (UPLOADED). Un fichier non conforme est refusé et supprimé.",
  })
  @ApiOkResponse({ type: UploadSessionResponseDto })
  @MediaApiErrors(400, 401, 403, 404, 409, 410, 422, 429, 503)
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId", uuid) sessionId: string,
    @Client() client: ClientContext,
  ): Promise<UploadSessionResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeSession(
      await this.uploads.complete(actor, sessionId, client),
    )
  }
}
