import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  Client,
  CurrentUser,
  ErrorResponseDto,
  OptionalAuth,
  OptionalUser,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { InteractionService } from "../application/interaction.service"
import { interactionRateLimit } from "../interaction.config"
import { RecordViewDto } from "./dto/interaction.dto"

const MINUTE_MS = 60_000
const uuid = new ParseUUIDPipe({ version: "4" })

function ApiErrors(...statuses: Array<400 | 401 | 404 | 429>) {
  const descriptions: Record<number, string> = {
    400: "Requête invalide",
    401: "Authentification requise",
    404: "Annonce introuvable",
    429: "Trop de requêtes",
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

@ApiTags("interactions")
@Controller({ path: "interactions", version: "1" })
export class InteractionController {
  constructor(private readonly interactions: InteractionService) {}

  @Get("favorites")
  @ApiBearerAuth()
  @Throttle({ default: { limit: interactionRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Mes favoris",
    description:
      "Biens favoris avec l’annonce publiée la plus récente. Alimente le profil de recommandation.",
  })
  @ApiErrors(401, 429)
  listFavorites(@CurrentUser() user: AuthenticatedUser) {
    return this.interactions.listFavorites(user)
  }

  @Get("favorites/:listingId")
  @ApiBearerAuth()
  @Throttle({ default: { limit: interactionRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "L’annonce est-elle en favori ?" })
  @ApiErrors(401, 404, 429)
  isFavorite(
    @Param("listingId", uuid) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interactions.isFavorite(user, listingId)
  }

  @Post("favorites/:listingId")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: interactionRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Ajouter un favori",
    description: "Idempotent. Exclut le bien des prochaines recommandations.",
  })
  @ApiOkResponse({ description: "{ favorited, created }" })
  @ApiErrors(401, 404, 429)
  addFavorite(
    @Param("listingId", uuid) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interactions.addFavorite(user, listingId)
  }

  @Delete("favorites/:listingId")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: interactionRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Retirer un favori", description: "Idempotent." })
  @ApiErrors(401, 404, 429)
  removeFavorite(
    @Param("listingId", uuid) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interactions.removeFavorite(user, listingId)
  }

  @Post("views")
  @OptionalAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: interactionRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Enregistrer une consultation d’annonce",
    description:
      "Écrit `property_views` (signal comportemental). Auth optionnelle. Pas de contenu privé.",
  })
  @ApiErrors(400, 404, 429)
  recordView(
    @Body() body: RecordViewDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() _client: ClientContext,
  ) {
    return this.interactions.recordView(user, body)
  }
}
