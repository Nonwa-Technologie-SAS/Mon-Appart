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
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ActorService,
  Client,
  CurrentUser,
  OptionalAuth,
  OptionalUser,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { PropertyMediaService } from "../application/property-media.service"
import { mediaMutationRateLimit } from "../media.config"
import { ReorderMediaDto, UpdateMediaDto } from "./dto/media-request.dto"
import {
  DownloadLinkResponseDto,
  MediaListResponseDto,
  MediaResponseDto,
} from "./dto/media-response.dto"
import { MediaApiErrors } from "./media-api-errors"
import { serializeLink, serializeMedia } from "./media.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000

@ApiTags("media")
@Controller({ path: "properties/:propertyId/media", version: "1" })
export class PropertyMediaController {
  constructor(
    private readonly actors: ActorService,
    private readonly media: PropertyMediaService,
  ) {}

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Médias d'un bien",
    description:
      "Public : photos et vidéos prêtes et publiques d'un bien actif. Gestionnaire : tous les médias non supprimés avec leur statut (documents sans URL).",
  })
  @ApiOkResponse({ type: MediaListResponseDto })
  @MediaApiErrors(400, 404)
  async list(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Param("propertyId", uuid) propertyId: string,
  ): Promise<MediaListResponseDto> {
    const actor = await this.actors.resolveOptional(user)
    const { items } = await this.media.list(actor, propertyId)
    return { items: items.map(serializeMedia) }
  }

  @Patch("order")
  @ApiBearerAuth()
  @Throttle({ default: { limit: mediaMutationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Réordonner les médias",
    description:
      "La liste doit contenir exactement les médias actuels du bien. La première photo publique prête devient l'image principale.",
  })
  @ApiOkResponse({ type: MediaListResponseDto })
  @MediaApiErrors(400, 401, 403, 404, 409, 422, 429)
  async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId", uuid) propertyId: string,
    @Body() dto: ReorderMediaDto,
    @Client() client: ClientContext,
  ): Promise<MediaListResponseDto> {
    const actor = await this.actors.resolve(user)
    const items = await this.media.reorder(
      actor,
      propertyId,
      dto.mediaIds,
      client,
    )
    return { items: items.map(serializeMedia) }
  }

  @Patch(":mediaId")
  @ApiBearerAuth()
  @Throttle({ default: { limit: mediaMutationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Définir l'image principale",
    description:
      "La photo (publique et prête) passe en tête ; l'ordre des autres est conservé. Seule la fiche du bien est réindexée.",
  })
  @ApiOkResponse({ type: MediaResponseDto })
  @MediaApiErrors(400, 401, 403, 404, 409, 422, 429)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId", uuid) propertyId: string,
    @Param("mediaId", uuid) mediaId: string,
    @Body() _dto: UpdateMediaDto,
    @Client() client: ClientContext,
  ): Promise<MediaResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeMedia(
      await this.media.setPrimary(actor, propertyId, mediaId, client),
    )
  }

  @Delete(":mediaId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Throttle({ default: { limit: mediaMutationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Supprimer un média",
    description:
      "Masqué immédiatement et retiré du CDN ; l'original est purgé après la rétention, sauf s'il sert de justificatif à une vérification.",
  })
  @ApiNoContentResponse()
  @MediaApiErrors(400, 401, 403, 404, 429)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId", uuid) propertyId: string,
    @Param("mediaId", uuid) mediaId: string,
    @Client() client: ClientContext,
  ): Promise<void> {
    const actor = await this.actors.resolve(user)
    await this.media.remove(actor, propertyId, mediaId, client)
  }

  @Get(":mediaId/download")
  @ApiBearerAuth()
  @Throttle({ default: { limit: mediaMutationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Lien de téléchargement de l'original",
    description:
      "URL présignée courte. Gestionnaire du bien, ou modération des justificatifs (`verification:read`) pour un document. Accès aux documents audité.",
  })
  @ApiOkResponse({ type: DownloadLinkResponseDto })
  @MediaApiErrors(400, 401, 404, 409, 429, 503)
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId", uuid) propertyId: string,
    @Param("mediaId", uuid) mediaId: string,
    @Client() client: ClientContext,
  ): Promise<DownloadLinkResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeLink(
      await this.media.download(actor, propertyId, mediaId, client),
    )
  }
}
