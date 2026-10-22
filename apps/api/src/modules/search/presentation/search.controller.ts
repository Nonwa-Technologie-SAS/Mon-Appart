import { applyDecorators, Controller, Get, Query } from "@nestjs/common"
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
  ErrorResponseDto,
  OptionalAuth,
  OptionalUser,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { SearchService } from "../application/search.service"
import { searchRateLimit, suggestRateLimit } from "../search.config"
import { SearchQueryDto, SuggestionQueryDto } from "./dto/search-request.dto"
import {
  SearchResponseDto,
  SuggestionResponseDto,
} from "./dto/search-response.dto"

const MINUTE_MS = 60_000

function SearchApiErrors() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description:
        "Paramètres invalides (VALIDATION_FAILED, INVALID_SEARCH_QUERY, INVALID_PRICE_RANGE, INVALID_SURFACE_RANGE, INVALID_GEO_COORDINATES, INVALID_RADIUS, INVALID_CURSOR)",
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: 429,
      description: "Trop de requêtes (RATE_LIMITED)",
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: 503,
      description:
        "Moteur indisponible sans repli (SEARCH_ENGINE_UNAVAILABLE, SEARCH_TIMEOUT)",
      type: ErrorResponseDto,
    }),
  )
}

@ApiTags("search")
@Controller({ path: "search", version: "1" })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @Throttle({ default: { limit: searchRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Rechercher des annonces publiées",
    description:
      "Texte libre, filtres de lieu (codes), rayon PostGIS, prix courant, surfaces, pièces, équipements, tri, facettes et pagination par curseur. Annonces publiées uniquement. L'authentification est facultative ; elle ne sert qu'à rattacher l'historique (`submit=true`).",
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @SearchApiErrors()
  find(
    @Query() query: SearchQueryDto,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
  ): Promise<SearchResponseDto> {
    return this.search.search(query, { user, requestId: client.requestId })
  }

  @Get("suggestions")
  @OptionalAuth()
  @Throttle({ default: { limit: suggestRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary:
      "Autocomplétion (villes, communes, quartiers, types, recherches en stock)",
    description:
      "Index en mémoire : aucune requête SQL par frappe. Rien n'est historisé.",
  })
  @ApiOkResponse({ type: SuggestionResponseDto })
  @SearchApiErrors()
  suggestions(
    @Query() query: SuggestionQueryDto,
  ): Promise<SuggestionResponseDto> {
    return this.search.suggest(query.q, query.limit)
  }
}
