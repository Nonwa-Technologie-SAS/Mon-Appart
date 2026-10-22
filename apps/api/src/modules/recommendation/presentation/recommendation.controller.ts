import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ActorService,
  Client,
  CurrentUser,
  ErrorResponseDto,
  OptionalAuth,
  OptionalUser,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { BehaviorProfileService } from "../application/behavior-profile.service"
import { PreferenceService } from "../application/preference.service"
import { RecommendationService } from "../application/recommendation.service"
import {
  feedbackRateLimit,
  recommendationRateLimit,
} from "../recommendation.config"
import {
  RecommendationFeedbackDto,
  RecommendationQueryDto,
  SimilarQueryDto,
  UpdatePreferencesDto,
} from "./dto/recommendation-request.dto"
import {
  RecommendationPreferencesDto,
  RecommendationResponseDto,
} from "./dto/recommendation-response.dto"

const MINUTE_MS = 60_000

function ApiErrors(...statuses: Array<400 | 401 | 404 | 429 | 503>) {
  const descriptions: Record<number, string> = {
    400: "Paramètres invalides (VALIDATION_FAILED, INVALID_RECOMMENDATION_QUERY, INVALID_PREFERENCES, BUDGET_PERIOD_REQUIRED, INVALID_CURSOR)",
    401: "Authentification requise (UNAUTHENTICATED)",
    404: "Introuvable (LISTING_NOT_FOUND, RECOMMENDATION_NOT_FOUND)",
    429: "Trop de requêtes (RATE_LIMITED)",
    503: "Recommandations momentanément indisponibles (RECOMMENDATIONS_UNAVAILABLE)",
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

@ApiTags("recommendations")
@Controller({ path: "recommendations", version: "1" })
export class RecommendationController {
  constructor(
    private readonly recommendations: RecommendationService,
    private readonly preferences: PreferenceService,
    private readonly behavior: BehaviorProfileService,
    private readonly actors: ActorService,
  ) {}

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @Throttle({ default: { limit: recommendationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Annonces recommandées",
    description:
      "Connecté : préférences déclarées et activité récente, liste persistée (chaque élément a un `id` pour les retours). Visiteur : sélection générique (fraîcheur, complétude), non persistée. Les filtres de la requête sont stricts ; le budget déclaré n'est jamais dépassé au-delà de la tolérance choisie.",
  })
  @ApiOkResponse({ type: RecommendationResponseDto })
  @ApiErrors(400, 429, 503)
  list(
    @Query() query: RecommendationQueryDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
  ): Promise<RecommendationResponseDto> {
    return this.recommendations.personalized(query, {
      user,
      requestId: client.requestId,
    })
  }

  @Get("similar/:listingPublicId")
  @OptionalAuth()
  @ApiBearerAuth()
  @Throttle({ default: { limit: recommendationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Annonces similaires à une annonce publiée",
    description:
      "Même type d'offre, même catégorie de bien, même ville, prix comparable (même devise et périodicité). La liste est élargie au-delà de ±40 % du prix s'il y a trop peu de résultats.",
  })
  @ApiParam({ name: "listingPublicId", format: "uuid" })
  @ApiOkResponse({ type: RecommendationResponseDto })
  @ApiErrors(400, 404, 429, 503)
  similar(
    @Param("listingPublicId") listingPublicId: string,
    @Query() query: SimilarQueryDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
  ): Promise<RecommendationResponseDto> {
    return this.recommendations.similar(listingPublicId, query, {
      user,
      requestId: client.requestId,
    })
  }

  @Post(":recommendationId/feedback")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Throttle({ default: { limit: feedbackRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Retour sur une recommandation servie",
    description:
      "Idempotent : un même type de retour enregistré deux fois ne compte qu'une fois. Seules les recommandations servies à l'utilisateur connecté sont accessibles.",
  })
  @ApiParam({ name: "recommendationId", format: "uuid" })
  @ApiNoContentResponse({ description: "Retour enregistré" })
  @ApiErrors(400, 401, 404, 429)
  async feedback(
    @Param("recommendationId") recommendationId: string,
    @Body() dto: RecommendationFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.recommendations.feedback(user, recommendationId, dto.type)
  }

  @Get("preferences")
  @ApiBearerAuth()
  @Throttle({ default: { limit: recommendationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Mes préférences de recommandation" })
  @ApiOkResponse({ type: RecommendationPreferencesDto })
  @ApiErrors(401, 429)
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecommendationPreferencesDto> {
    const actor = await this.actors.resolve(user)
    return this.preferences.get(actor.userId)
  }

  @Put("preferences")
  @ApiBearerAuth()
  @Throttle({ default: { limit: recommendationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Remplacer mes préférences",
    description:
      "Remplacement complet (un champ absent est effacé). Lieux, types et équipements sont des codes du référentiel. Le budget est enregistré tel quel ; sa périodicité doit être donnée si elle ne se déduit pas des types d'offre.",
  })
  @ApiOkResponse({ type: RecommendationPreferencesDto })
  @ApiErrors(400, 401, 429)
  async putPreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecommendationPreferencesDto> {
    const actor = await this.actors.resolve(user)
    return this.preferences.replace(actor.userId, actor.publicId, dto)
  }

  @Delete("behavior-profile")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: recommendationRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Effacer mon profil comportemental inféré",
    description:
      "Ne touche pas aux préférences déclarées. Le classement revient à GENERIC ou PREFERENCES jusqu’à de nouveaux signaux fiables.",
  })
  @ApiErrors(401, 429)
  async clearBehavior(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ cleared: boolean }> {
    const actor = await this.actors.resolve(user)
    return this.behavior.clearInferred(actor.userId, actor.publicId)
  }
}
