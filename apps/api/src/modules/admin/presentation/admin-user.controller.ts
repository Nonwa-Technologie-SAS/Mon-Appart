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
  type AccountDecision,
  type Actor,
  type ClientContext,
} from "../../identity"
import {
  adminContactRevealRateLimit,
  adminMutationRateLimit,
} from "../admin.config"
import { AdminUserService } from "../application/admin-user.service"
import { AdminAccessGuard, AdminActor } from "./admin-access.guard"
import { AdminApiErrors } from "./admin-api-errors"
import {
  AccountDecisionDto,
  AddNoteDto,
  ChangeRoleDto,
  ReasonDto,
  UserSearchQueryDto,
} from "./admin.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000
const mutation = {
  default: { limit: adminMutationRateLimit, ttl: MINUTE_MS },
}
const reveal = {
  default: { limit: adminContactRevealRateLimit, ttl: MINUTE_MS },
}

/**
 * Comptes utilisateurs. Les décisions délèguent au module Identity
 * (`AccountAdminService`) : verrou de ligne, statut attendu, protection du
 * dernier SUPER_ADMIN, révocation des sessions et audit.
 */
@ApiTags("admin-users")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/users", version: "1" })
export class AdminUserController {
  constructor(private readonly users: AdminUserService) {}

  @Get()
  @Permissions("user:read")
  @ApiOperation({
    summary: "Rechercher des comptes",
    description:
      "Coordonnées toujours masquées dans la liste. La recherche par e-mail ou téléphone exige `user:pii`.",
  })
  @ApiOkResponse({ description: "Page de comptes" })
  @AdminApiErrors(400, 401, 403)
  search(@AdminActor() actor: Actor, @Query() query: UserSearchQueryDto) {
    return this.users.search(actor, query)
  }

  @Get(":userId")
  @Permissions("user:read")
  @Throttle(reveal)
  @ApiOperation({
    summary: "Fiche d'un compte",
    description:
      "Coordonnées complètes avec `user:pii` seulement ; chaque consultation est alors auditée.",
  })
  @ApiOkResponse({ description: "Fiche du compte et actions permises" })
  @AdminApiErrors(400, 401, 403, 404, 429)
  detail(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Client() client: ClientContext,
  ) {
    return this.users.detail(actor, userId, client)
  }

  @Post(":userId/suspend")
  @Permissions("user:suspend")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({
    summary: "Suspendre un compte",
    description:
      "Sessions révoquées. Pas de levée automatique : réactivation manuelle et motivée.",
  })
  @AdminApiErrors(400, 401, 403, 404, 409, 429)
  suspend(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Body() body: AccountDecisionDto,
    @Client() client: ClientContext,
  ) {
    return this.decide(actor, userId, "SUSPEND", body, client)
  }

  @Post(":userId/ban")
  @Permissions("user:ban")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({ summary: "Bannir un compte (sessions révoquées)" })
  @AdminApiErrors(400, 401, 403, 404, 409, 429)
  ban(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Body() body: AccountDecisionDto,
    @Client() client: ClientContext,
  ) {
    return this.decide(actor, userId, "BAN", body, client)
  }

  @Post(":userId/reactivate")
  @Permissions("user:reactivate")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({
    summary: "Réactiver un compte suspendu ou banni",
    description:
      "ACTIVE si une coordonnée est vérifiée, sinon PENDING. Le titulaire est notifié.",
  })
  @AdminApiErrors(400, 401, 403, 404, 409, 429)
  reactivate(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Body() body: AccountDecisionDto,
    @Client() client: ClientContext,
  ) {
    return this.decide(actor, userId, "REACTIVATE", body, client)
  }

  @Post(":userId/revoke-sessions")
  @Permissions("user:revoke_sessions")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({ summary: "Déconnecter le compte de tous ses appareils" })
  @AdminApiErrors(400, 401, 403, 404, 429)
  revokeSessions(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Body() body: ReasonDto,
    @Client() client: ClientContext,
  ) {
    return this.users.revokeSessions(actor, userId, body.reason, client)
  }

  @Post(":userId/roles")
  @Permissions("role:manage")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({
    summary: "Attribuer ou retirer un rôle (audité)",
    description:
      "Interdit sur soi-même ; ADMIN et SUPER_ADMIN réservés au SUPER_ADMIN ; le dernier SUPER_ADMIN actif est protégé. Un retrait révoque les sessions du compte.",
  })
  @AdminApiErrors(400, 401, 403, 404, 409, 429)
  changeRole(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Body() body: ChangeRoleDto,
    @Client() client: ClientContext,
  ) {
    return this.users.changeRole(
      actor,
      userId,
      body.role,
      body.operation,
      body.reason,
      client,
    )
  }

  @Post(":userId/notes")
  @Permissions("admin_note:create")
  @Throttle(mutation)
  @ApiOperation({
    summary: "Ajouter une note interne",
    description: "Jamais visible du titulaire ; non modifiable.",
  })
  @AdminApiErrors(400, 401, 403, 404, 429)
  addNote(
    @AdminActor() actor: Actor,
    @Param("userId", uuid) userId: string,
    @Body() body: AddNoteDto,
    @Client() client: ClientContext,
  ) {
    return this.users.addNote(actor, userId, body.body, client)
  }

  private decide(
    actor: Actor,
    userId: string,
    decision: AccountDecision,
    body: AccountDecisionDto,
    client: ClientContext,
  ) {
    return this.users.decide(actor, userId, decision, body, client)
  }
}
