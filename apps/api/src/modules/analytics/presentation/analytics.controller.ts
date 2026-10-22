import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common"
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  Client,
  CurrentUser,
  OptionalAuth,
  OptionalUser,
  Permissions,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { analyticsRateLimit } from "../analytics.config"
import { AnalyticsQueryService } from "../application/analytics-query.service"
import { ConsentService } from "../application/consent.service"
import { IngestionService } from "../application/ingestion.service"
import { AnalyticsApiErrors } from "./analytics-api-errors"
import {
  AnalyticsRangeQueryDto,
  ConsentResponseDto,
  IngestResponseDto,
  MyListingsStatsQueryDto,
  UpdateConsentDto,
} from "./analytics.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000

@ApiTags("analytics")
@Controller({ path: "analytics", version: "1" })
export class AnalyticsController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly consents: ConsentService,
    private readonly queries: AnalyticsQueryService,
  ) {}

  @Post("events")
  @OptionalAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: analyticsRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Envoyer un lot d'événements de navigation (web, mobile)",
    description:
      "Lot de 100 événements au plus, validé contre le catalogue `@mon-appart/analytics`. Idempotent par `eventId`. Les événements métier (`origin: server`) sont refusés : ils sont produits par le backend. Sans consentement analytique valide, le lot est ignoré.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["context", "events"],
      properties: {
        context: { type: "object" },
        events: { type: "array", maxItems: 100, items: { type: "object" } },
      },
    },
  })
  @ApiAcceptedResponse({ type: IngestResponseDto })
  @AnalyticsApiErrors(400, 429)
  ingest(
    @Body() body: unknown,
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Client() client: ClientContext,
  ): Promise<IngestResponseDto> {
    return this.ingestion.ingest(body, user, client)
  }

  @Get("consent")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mon consentement à la mesure d'audience" })
  @ApiOkResponse({ type: ConsentResponseDto })
  @AnalyticsApiErrors(401)
  consent(@CurrentUser() user: AuthenticatedUser): Promise<ConsentResponseDto> {
    return this.consents.get(user)
  }

  @Put("consent")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Accorder ou retirer mon consentement",
    description:
      "Distinct des CGU et du consentement marketing. Le retrait supprime les événements de navigation déjà collectés sur le compte.",
  })
  @ApiOkResponse({ type: ConsentResponseDto })
  @AnalyticsApiErrors(400, 401, 422)
  setConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateConsentDto,
    @Client() client: ClientContext,
  ): Promise<ConsentResponseDto> {
    return this.consents.set(user, dto, client)
  }

  @Get("me/listings")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Statistiques agrégées des annonces que je gère",
    description:
      "Compteurs agrégés uniquement, jamais d'identité ni de comportement individuel des visiteurs.",
  })
  @ApiOkResponse({ description: "Page d'annonces avec totaux et taux" })
  @AnalyticsApiErrors(400, 401)
  myListings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MyListingsStatsQueryDto,
  ) {
    return this.queries.myListings(user, query)
  }

  @Get("listings/:listingId")
  @ApiBearerAuth()
  @Permissions("analytics:read")
  @ApiOperation({
    summary: "Statistiques d'une annonce que je gère",
    description:
      "Totaux, taux et série journalière. 404 si l'annonce n'existe pas ou n'est pas gérée par l'appelant.",
  })
  @ApiOkResponse({ description: "Totaux, taux et série journalière" })
  @AnalyticsApiErrors(400, 401, 403, 404)
  listing(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listingId", uuid) listingId: string,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.queries.listing(user, listingId, query)
  }
}

@ApiTags("admin-analytics")
@ApiBearerAuth()
@Permissions("analytics:admin")
@Controller({ path: "admin/analytics", version: "1" })
export class AdminAnalyticsController {
  constructor(private readonly queries: AnalyticsQueryService) {}

  @Get("metrics")
  @ApiOperation({
    summary: "Catalogue des indicateurs BI",
    description:
      "Définitions stables (formule, sources, rôles, limites). Aucune donnée chiffrée.",
  })
  @ApiOkResponse({ description: "Catalogue METRICS_CATALOG" })
  @AnalyticsApiErrors(401, 403)
  metrics() {
    return this.queries.metricsCatalog()
  }

  @Get("overview")
  @ApiOperation({ summary: "Indicateurs clés de la plateforme" })
  @ApiOkResponse({ description: "KPI agrégés sur la période" })
  @AnalyticsApiErrors(400, 401, 403)
  overview(@Query() query: AnalyticsRangeQueryDto) {
    return this.queries.overview(query)
  }

  @Get("direction")
  @ApiOperation({
    summary: "Vue direction (KPI + demande + offre)",
    description:
      "Compose overview, search et snapshot marché. Les revenus restent sur billing/summary.",
  })
  @ApiOkResponse({ description: "Synthèse décisionnelle" })
  @AnalyticsApiErrors(400, 401, 403)
  direction(@Query() query: AnalyticsRangeQueryDto) {
    return this.queries.direction(query)
  }

  @Get("market")
  @ApiOperation({
    summary: "Marché : stock d’annonces et distributions de prix",
    description:
      "Snapshot on-demand. Petits groupes masqués (ANALYTICS_MIN_GROUP_SIZE). Prix d’annonce ≠ transaction.",
  })
  @ApiOkResponse({ description: "Offre et prix observés" })
  @AnalyticsApiErrors(401, 403)
  market() {
    return this.queries.market()
  }

  @Get("funnel")
  @ApiOperation({
    summary: "Entonnoir de conversion (visiteurs ayant consenti)",
    description: "Unité : acteur-jour. Cohorte : visiteurs avec consentement.",
  })
  @ApiOkResponse({ description: "Étapes et taux de passage" })
  @AnalyticsApiErrors(400, 401, 403)
  funnel(@Query() query: AnalyticsRangeQueryDto) {
    return this.queries.funnel(query)
  }

  @Get("search")
  @ApiOperation({ summary: "Recherches : volumes, zéro résultat, critères" })
  @ApiOkResponse({ description: "Ventilations (petits groupes regroupés)" })
  @AnalyticsApiErrors(400, 401, 403)
  search(@Query() query: AnalyticsRangeQueryDto) {
    return this.queries.search(query)
  }

  @Get("recommendations")
  @ApiOperation({
    summary: "Recommandations par version d'algorithme",
    description:
      "Taux de clic = ouvertures / impressions réellement affichées (pas les recommandations générées).",
  })
  @ApiOkResponse({ description: "Indicateurs par algorithme" })
  @AnalyticsApiErrors(400, 401, 403)
  recommendations(@Query() query: AnalyticsRangeQueryDto) {
    return this.queries.recommendations(query)
  }

  @Get("quality")
  @ApiOperation({ summary: "Qualité des données : ingestion et agrégation" })
  @ApiOkResponse({ description: "Rejets par motif et état du calcul" })
  @AnalyticsApiErrors(400, 401, 403)
  quality(@Query() query: AnalyticsRangeQueryDto) {
    return this.queries.quality(query)
  }
}
