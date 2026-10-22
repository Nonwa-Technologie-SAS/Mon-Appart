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
import { AdminListingService } from "../application/admin-listing.service"
import { AdminNoteService } from "../application/admin-note.service"
import type { ModerationDecision } from "../domain/moderation"
import { AdminAccessGuard, AdminActor } from "./admin-access.guard"
import { AdminApiErrors } from "./admin-api-errors"
import {
  AddNoteDto,
  ListingQueueQueryDto,
  ModerateListingDto,
} from "./admin.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const throttle = {
  default: { limit: adminMutationRateLimit, ttl: 60_000 },
}

/**
 * Modération des annonces. Lecture : `listing:moderate` ou `listing:suspend`
 * (vérifié par le service). Chaque décision exige sa propre permission et
 * passe par la machine à états du module Listing ; nul ne modère sa propre
 * annonce.
 */
@ApiTags("admin-listings")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/listings", version: "1" })
export class AdminListingController {
  constructor(
    private readonly listings: AdminListingService,
    private readonly notes: AdminNoteService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "File de modération",
    description: "PENDING_REVIEW par défaut ; plus anciennes d'abord.",
  })
  @ApiOkResponse({ description: "Page de la file" })
  @AdminApiErrors(400, 401, 403)
  queue(@AdminActor() actor: Actor, @Query() query: ListingQueueQueryDto) {
    return this.listings.queue(actor, query)
  }

  @Get(":listingId")
  @ApiOperation({
    summary: "Dossier de modération",
    description:
      "Contrôles de cohérence (aide à la décision, pas des preuves), historique, signalements, notes et décisions permises.",
  })
  @ApiOkResponse({ description: "Dossier de l'annonce" })
  @AdminApiErrors(400, 401, 403, 404)
  detail(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
  ) {
    return this.listings.detail(actor, listingId)
  }

  @Post(":listingId/approve")
  @Permissions("listing:moderate")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({ summary: "Publier une annonce en attente de validation" })
  @AdminApiErrors(400, 401, 403, 404, 409, 422, 429)
  approve(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
    @Body() body: ModerateListingDto,
    @Client() client: ClientContext,
  ) {
    return this.moderate(actor, listingId, "APPROVE", body, client)
  }

  @Post(":listingId/request-changes")
  @Permissions("listing:moderate")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({
    summary: "Renvoyer en brouillon pour corrections (motif obligatoire)",
  })
  @AdminApiErrors(400, 401, 403, 404, 409, 422, 429)
  requestChanges(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
    @Body() body: ModerateListingDto,
    @Client() client: ClientContext,
  ) {
    return this.moderate(actor, listingId, "REQUEST_CHANGES", body, client)
  }

  @Post(":listingId/reject")
  @Permissions("listing:moderate")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({ summary: "Refuser une annonce (motif obligatoire)" })
  @AdminApiErrors(400, 401, 403, 404, 409, 422, 429)
  reject(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
    @Body() body: ModerateListingDto,
    @Client() client: ClientContext,
  ) {
    return this.moderate(actor, listingId, "REJECT", body, client)
  }

  @Post(":listingId/suspend")
  @Permissions("listing:suspend")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({
    summary: "Suspendre une annonce publiée ou en pause (motif obligatoire)",
  })
  @AdminApiErrors(400, 401, 403, 404, 409, 422, 429)
  suspend(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
    @Body() body: ModerateListingDto,
    @Client() client: ClientContext,
  ) {
    return this.moderate(actor, listingId, "SUSPEND", body, client)
  }

  @Post(":listingId/restore")
  @Permissions("listing:suspend")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({
    summary: "Republier une annonce suspendue (justification interne requise)",
  })
  @AdminApiErrors(400, 401, 403, 404, 409, 422, 429)
  restore(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
    @Body() body: ModerateListingDto,
    @Client() client: ClientContext,
  ) {
    return this.moderate(actor, listingId, "RESTORE", body, client)
  }

  @Post(":listingId/notes")
  @Permissions("admin_note:create")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Ajouter une note interne",
    description: "Jamais visible du propriétaire ; non modifiable.",
  })
  @AdminApiErrors(400, 401, 403, 404, 429)
  addNote(
    @AdminActor() actor: Actor,
    @Param("listingId", uuid) listingId: string,
    @Body() body: AddNoteDto,
    @Client() client: ClientContext,
  ) {
    return this.notes.add(actor, "listing", listingId, body.body, client)
  }

  private moderate(
    actor: Actor,
    listingId: string,
    decision: ModerationDecision,
    body: ModerateListingDto,
    client: ClientContext,
  ) {
    return this.listings.moderate(actor, listingId, decision, body, client)
  }
}
