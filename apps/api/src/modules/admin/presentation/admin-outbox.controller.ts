import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AdminOutboxService } from "../application/admin-outbox.service"
import { AdminAccessGuard, AdminActor } from "./admin-access.guard"
import { AdminApiErrors } from "./admin-api-errors"

const uuid = new ParseUUIDPipe({ version: "4" })
const throttle = {
  default: { limit: adminMutationRateLimit, ttl: 60_000 },
}

/**
 * Exploitation des événements de domaine. Le payload n'est jamais exposé.
 * Rejeu réservé à `ops:events`.
 */
@ApiTags("admin-events")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/events", version: "1" })
export class AdminOutboxController {
  constructor(private readonly outbox: AdminOutboxService) {}

  @Get("outbox")
  @Permissions("ops:events")
  @ApiOperation({
    summary: "Événements Outbox",
    description:
      "Statut, tentatives et erreur masquée. Aucun payload métier n'est renvoyé.",
  })
  @ApiOkResponse({ description: "Liste paginée" })
  @AdminApiErrors(401, 403)
  list(
    @Query("status") status?: string,
    @Query("eventType") eventType?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.outbox.list({
      ...(status ? { status } : {}),
      ...(eventType ? { eventType } : {}),
      ...(cursor ? { cursor } : {}),
    })
  }

  @Get("outbox/stats")
  @Permissions("ops:events")
  @ApiOperation({ summary: "Compteurs Outbox par statut" })
  @AdminApiErrors(401, 403)
  stats() {
    return this.outbox.stats()
  }

  @Post("outbox/:eventId/replay")
  @Permissions("ops:events")
  @Throttle(throttle)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rejouer un événement en file morte",
    description: "Remet l'événement en PENDING puis tente une publication.",
  })
  @AdminApiErrors(401, 403, 409)
  replay(
    @Param("eventId", uuid) eventId: string,
    @AdminActor() actor: Actor,
    @Client() context: ClientContext,
  ) {
    return this.outbox.replay(eventId, actor, context)
  }
}
