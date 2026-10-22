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
} from "../../identity"
import { DownloadLinkResponseDto, serializeLink } from "../../media"
import { ReportService } from "../application/report.service"
import { ReviewService } from "../application/review.service"
import { SignalService } from "../application/signal.service"
import { TrustScoreService } from "../application/trust-score.service"
import { trustMutationRateLimit } from "../trust.config"
import {
  ApproveVerificationDto,
  AssignVerificationDto,
  EscalateVerificationDto,
  RejectVerificationDto,
  ReportQueueQueryDto,
  RequestInformationDto,
  ResolveReportDto,
  ReviewQueueQueryDto,
  ReviewSignalDto,
  RevokeVerificationDto,
  SignalQueryDto,
} from "./dto/trust-request.dto"
import {
  ReportQueueResponseDto,
  ReviewQueueResponseDto,
  ReviewReportResponseDto,
  ReviewVerificationResponseDto,
  SignalPageResponseDto,
  SignalResponseDto,
  TrustScoreResponseDto,
} from "./dto/trust-response.dto"
import { TrustApiErrors } from "./trust-api-errors"
import { serialize } from "./trust.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000
const throttle = { default: { limit: trustMutationRateLimit, ttl: MINUTE_MS } }

/**
 * Back-office Trust. Instruire (MODERATOR, `verification:review`) et décider
 * (TRUST_OFFICER, `verification:approve|reject|revoke`) sont distincts ; la
 * consultation des pièces exige `verification:documents`, que le rôle ADMIN
 * n'a pas par défaut. Nul ne traite son propre dossier.
 */
@ApiTags("trust-admin")
@ApiBearerAuth()
@Controller({ path: "admin/trust", version: "1" })
export class TrustAdminController {
  constructor(
    private readonly actors: ActorService,
    private readonly reviews: ReviewService,
    private readonly reports: ReportService,
    private readonly signals: SignalService,
    private readonly scores: TrustScoreService,
  ) {}

  // -------------------------------------------------------- vérifications

  @Get("verifications")
  @Permissions("verification:read")
  @ApiOperation({
    summary: "File d'examen des dossiers",
    description: "Plus anciens d'abord ; brouillons exclus.",
  })
  @ApiOkResponse({ type: ReviewQueueResponseDto })
  @TrustApiErrors(400, 401, 403)
  async queue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewQueueQueryDto,
  ): Promise<ReviewQueueResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reviews.queue(actor, query))
  }

  @Get("verifications/:verificationId")
  @Permissions("verification:read")
  @ApiOperation({
    summary: "Dossier complet pour instruction (consultation auditée)",
  })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404)
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reviews.detail(actor, verificationId, client))
  }

  @Get("verifications/:verificationId/documents/:documentId/download")
  @Permissions("verification:read", "verification:documents")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Lien de lecture court d'une pièce (accès audité)",
  })
  @ApiOkResponse({ type: DownloadLinkResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 429)
  async document(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Param("documentId", uuid) documentId: string,
    @Client() client: ClientContext,
  ): Promise<DownloadLinkResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeLink(
      await this.reviews.documentLink(
        actor,
        verificationId,
        documentId,
        client,
      ),
    )
  }

  @Post("verifications/:verificationId/assign")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:review")
  @Throttle(throttle)
  @ApiOperation({ summary: "Prendre en charge ou affecter un dossier" })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: AssignVerificationDto,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reviews.assign(actor, verificationId, dto, client),
    )
  }

  @Post("verifications/:verificationId/request-information")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:review")
  @Throttle(throttle)
  @ApiOperation({ summary: "Demander un complément au déclarant" })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async requestInformation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: RequestInformationDto,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reviews.requestInformation(actor, verificationId, dto, client),
    )
  }

  @Post("verifications/:verificationId/escalate")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:review")
  @Throttle(throttle)
  @ApiOperation({ summary: "Escalader (priorité haute)" })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 429)
  async escalate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: EscalateVerificationDto,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reviews.escalate(actor, verificationId, dto, client),
    )
  }

  @Post("verifications/:verificationId/approve")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:approve")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Approuver un dossier",
    description:
      "Pièces obligatoires prêtes, identité préalable valide, rattachement revendiqué toujours courant. Exige aussi `verification:documents` si le dossier contient des pièces.",
  })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: ApproveVerificationDto,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reviews.approve(actor, verificationId, dto, client),
    )
  }

  @Post("verifications/:verificationId/reject")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:reject")
  @Throttle(throttle)
  @ApiOperation({ summary: "Rejeter un dossier (motif obligatoire)" })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: RejectVerificationDto,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reviews.reject(actor, verificationId, dto, client),
    )
  }

  @Post("verifications/:verificationId/revoke")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:revoke")
  @Throttle(throttle)
  @ApiOperation({ summary: "Révoquer une vérification approuvée" })
  @ApiOkResponse({ type: ReviewVerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: RevokeVerificationDto,
    @Client() client: ClientContext,
  ): Promise<ReviewVerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.reviews.revoke(actor, verificationId, dto, client),
    )
  }

  // -------------------------------------------------------- signalements

  @Get("reports")
  @Permissions("report:review")
  @ApiOperation({ summary: "File des signalements" })
  @ApiOkResponse({ type: ReportQueueResponseDto })
  @TrustApiErrors(400, 401, 403)
  async reportQueue(
    @Query() query: ReportQueueQueryDto,
  ): Promise<ReportQueueResponseDto> {
    return serialize(await this.reports.queue(query))
  }

  @Get("reports/:reportId")
  @Permissions("report:review")
  @ApiOperation({ summary: "Détail d'un signalement" })
  @ApiOkResponse({ type: ReviewReportResponseDto })
  @TrustApiErrors(400, 401, 403, 404)
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param("reportId", uuid) reportId: string,
  ): Promise<ReviewReportResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reports.detail(actor, reportId))
  }

  @Post("reports/:reportId/assign")
  @HttpCode(HttpStatus.OK)
  @Permissions("report:review")
  @Throttle(throttle)
  @ApiOperation({ summary: "Prendre en charge un signalement" })
  @ApiOkResponse({ type: ReviewReportResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 429)
  async assignReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("reportId", uuid) reportId: string,
    @Client() client: ClientContext,
  ): Promise<ReviewReportResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reports.assign(actor, reportId, client))
  }

  @Post("reports/:reportId/resolve")
  @HttpCode(HttpStatus.OK)
  @Permissions("report:review")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Clore un signalement",
    description:
      "LISTING_SUSPENDED exige aussi `listing:suspend` (workflow des annonces). Aucune vérification n'est révoquée automatiquement.",
  })
  @ApiOkResponse({ type: ReviewReportResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 429)
  async resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("reportId", uuid) reportId: string,
    @Body() dto: ResolveReportDto,
    @Client() client: ClientContext,
  ): Promise<ReviewReportResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.reports.resolve(actor, reportId, dto, client))
  }

  // -------------------------------------------------------- alertes, score

  @Get("signals")
  @ApiOperation({
    summary: "Alertes des règles de risque",
    description: "`verification:review` ou `report:review`.",
  })
  @ApiOkResponse({ type: SignalPageResponseDto })
  @TrustApiErrors(400, 401, 403)
  async signalList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SignalQueryDto,
  ): Promise<SignalPageResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.signals.list(actor, query))
  }

  @Post("signals/:signalId/review")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({
    summary: "Confirmer ou écarter une alerte",
    description: "Sans effet automatique sur le compte ou l'annonce.",
  })
  @ApiOkResponse({ type: SignalResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 429)
  async reviewSignal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("signalId", uuid) signalId: string,
    @Body() dto: ReviewSignalDto,
    @Client() client: ClientContext,
  ): Promise<SignalResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.signals.review(actor, signalId, dto, client))
  }

  @Get("users/:userId/score")
  @Permissions("trust_score:read")
  @ApiOperation({
    summary: "Score de confiance interne (consultation auditée)",
    description:
      "Aide à la modération, jamais affiché publiquement. Nul tant que les données sont insuffisantes.",
  })
  @ApiOkResponse({ type: TrustScoreResponseDto })
  @TrustApiErrors(400, 401, 403, 404)
  async score(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId", uuid) userId: string,
    @Client() client: ClientContext,
  ): Promise<TrustScoreResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.scores.get(actor, userId, client))
  }
}
