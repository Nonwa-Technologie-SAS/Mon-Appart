import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  Client,
  Permissions,
  type Actor,
  type ClientContext,
} from "../../identity"
import { adminMutationRateLimit } from "../admin.config"
import { AdminAuditService } from "../application/admin-audit.service"
import { AdminDashboardService } from "../application/admin-dashboard.service"
import { ModerationReasonService } from "../application/moderation-reason.service"
import { AdminAccessGuard, AdminActor } from "./admin-access.guard"
import { AdminApiErrors } from "./admin-api-errors"
import {
  AuditQueryDto,
  CreateModerationReasonDto,
  ModerationReasonQueryDto,
  UpdateModerationReasonDto,
} from "./admin.dto"

const MINUTE_MS = 60_000
const throttle = { default: { limit: adminMutationRateLimit, ttl: MINUTE_MS } }

/**
 * Socle du back-office : identité et droits effectifs, files de travail,
 * matrice des rôles, motifs de modération et journal d'audit.
 */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin", version: "1" })
export class AdminController {
  constructor(
    private readonly dashboards: AdminDashboardService,
    private readonly reasons: ModerationReasonService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Identité et permissions effectives (relues en base)",
    description:
      "Sert à construire l'interface ; chaque route revérifie ses permissions.",
  })
  @ApiOkResponse({ description: "Rôles, permissions et rôles attribuables" })
  @AdminApiErrors(401, 403)
  me(@AdminActor() actor: Actor) {
    return this.dashboards.me(actor)
  }

  @Get("dashboard")
  @ApiOperation({
    summary: "Files de travail en direct, filtrées par permission",
    description:
      "Chaque widget porte sa définition ; `computedAt` date le calcul. Les indicateurs d'usage sont sous `/admin/analytics`.",
  })
  @ApiOkResponse({ description: "Files de travail" })
  @AdminApiErrors(401, 403)
  dashboard(@AdminActor() actor: Actor) {
    return this.dashboards.dashboard(actor)
  }

  @Get("roles")
  @Permissions("role:read")
  @ApiOperation({ summary: "Rôles et permissions associées (lecture seule)" })
  @ApiOkResponse({ description: "Matrice des rôles" })
  @AdminApiErrors(401, 403)
  roles() {
    return this.dashboards.roles()
  }

  // -------------------------------------------------------- motifs

  @Get("moderation-reasons")
  @ApiOperation({ summary: "Motifs de modération" })
  @ApiOkResponse({ description: "Motifs, actifs seulement par défaut" })
  @AdminApiErrors(400, 401, 403)
  listReasons(@Query() query: ModerationReasonQueryDto) {
    return this.reasons.list(query)
  }

  @Post("moderation-reasons")
  @Permissions("settings:manage")
  @Throttle(throttle)
  @ApiOperation({ summary: "Créer un motif de modération (audité)" })
  @AdminApiErrors(400, 401, 403, 409, 429)
  createReason(
    @AdminActor() actor: Actor,
    @Body() body: CreateModerationReasonDto,
    @Client() client: ClientContext,
  ) {
    return this.reasons.create(actor, body, client)
  }

  @Patch("moderation-reasons/:code")
  @Permissions("settings:manage")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Modifier ou désactiver un motif (audité)",
    description: "Le code et l'action sont immuables.",
  })
  @AdminApiErrors(400, 401, 403, 404, 429)
  updateReason(
    @AdminActor() actor: Actor,
    @Param("code") code: string,
    @Body() body: UpdateModerationReasonDto,
    @Client() client: ClientContext,
  ) {
    return this.reasons.update(actor, code, body, client)
  }

  // -------------------------------------------------------- audit

  @Get("audit-logs")
  @Permissions("audit_log:read")
  @ApiOperation({
    summary: "Journal d'audit, du plus récent au plus ancien",
    description:
      "Pagination par curseur ; secrets et jetons masqués dans les valeurs.",
  })
  @ApiOkResponse({ description: "Page du journal" })
  @AdminApiErrors(400, 401, 403)
  auditLogs(@Query() query: AuditQueryDto) {
    return this.audit.list(query)
  }
}
