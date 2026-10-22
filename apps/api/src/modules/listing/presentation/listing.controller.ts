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
  Post,
  Put,
  Query,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import {
  ActorService,
  Client,
  CurrentUser,
  OptionalAuth,
  OptionalUser,
  Permissions,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { CatalogApiErrors } from "../../property"
import { ListingQueryService } from "../application/listing-query.service"
import { ListingService } from "../application/listing.service"
import {
  ChangeListingPriceDto,
  ChangeListingStatusDto,
  CreateListingDto,
  ListingQueryDto,
  PauseListingDto,
  PublishListingDto,
  UpdateListingDto,
} from "./dto/listing-request.dto"
import {
  ListingHistoryResponseDto,
  ListingPageResponseDto,
  ListingResponseDto,
} from "./dto/listing-response.dto"
import {
  serializeHistory,
  serializeListing,
  serializeListingSummary,
} from "./listing.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })

@ApiTags("listings")
@Controller({ path: "listings", version: "1" })
export class ListingController {
  constructor(
    private readonly actors: ActorService,
    private readonly listings: ListingService,
    private readonly queries: ListingQueryService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @Permissions("listing:create")
  @ApiOperation({
    summary: "Créer une annonce (brouillon) pour un bien géré",
    description:
      "Propriétaire ou mandataire rattaché au bien, ou admin (listing:manage).",
  })
  @ApiCreatedResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateListingDto,
    @Client() client: ClientContext,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolve(user)
    const publicId = await this.listings.create(actor, dto, client)
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Rechercher des annonces (pagination par curseur)",
    description:
      "Public : annonces publiées de biens actifs, triées par date de publication.",
  })
  @ApiOkResponse({ type: ListingPageResponseDto })
  @CatalogApiErrors(400, 401, 403, 422)
  async list(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Query() query: ListingQueryDto,
  ): Promise<ListingPageResponseDto> {
    const actor = await this.actors.resolveOptional(user)
    const page = await this.queries.list(actor, query)
    return {
      items: page.items.map((row) => serializeListingSummary(row, page.mode)),
      nextCursor: page.nextCursor,
    }
  }

  @Get(":publicId")
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Fiche annonce : bien, prix courant, localisation, équipements, médias",
  })
  @ApiOkResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 404)
  async get(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Param("publicId", uuid) publicId: string,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolveOptional(user)
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Get(":publicId/history")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Historique des prix et des statuts (gestionnaires, admin, modération)",
  })
  @ApiOkResponse({ type: ListingHistoryResponseDto })
  @CatalogApiErrors(400, 401, 403, 404)
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
  ): Promise<ListingHistoryResponseDto> {
    const actor = await this.actors.resolve(user)
    return serializeHistory(await this.queries.history(actor, publicId))
  }

  @Patch(":publicId")
  @ApiBearerAuth()
  @Permissions("listing:update")
  @ApiOperation({
    summary: "Modifier titre, description ou échéance",
    description: "Statut, prix, bien et type ne passent pas par cette route.",
  })
  @ApiOkResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: UpdateListingDto,
    @Client() client: ClientContext,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.listings.update(actor, publicId, dto, client)
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Put(":publicId/price")
  @ApiBearerAuth()
  @Permissions("listing:update")
  @ApiOperation({
    summary: "Changer le prix",
    description:
      "L'ancien prix est clôturé (valid_to) et conservé ; un seul prix courant.",
  })
  @ApiOkResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409, 422)
  async changePrice(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: ChangeListingPriceDto,
    @Client() client: ClientContext,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.listings.changePrice(actor, publicId, dto, client)
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Post(":publicId/publish")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Permissions("listing:publish")
  @ApiOperation({
    summary: "Publier (ou reprendre) une annonce",
    description:
      "Vérifie la complétude (bien actif et complet, titre, prix courant). Avec LISTING_MODERATION_REQUIRED=true, un brouillon passe en PENDING_REVIEW.",
  })
  @ApiOkResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409, 422)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: PublishListingDto,
    @Client() client: ClientContext,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.listings.publish(
      actor,
      publicId,
      dto.expiresAt ? { expiresAt: dto.expiresAt } : {},
      client,
    )
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Post(":publicId/pause")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Permissions("listing:publish")
  @ApiOperation({ summary: "Mettre une annonce publiée en pause" })
  @ApiOkResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409)
  async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: PauseListingDto,
    @Client() client: ClientContext,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.listings.changeStatus(
      actor,
      publicId,
      { status: "PAUSED", ...(dto.reason ? { reason: dto.reason } : {}) },
      client,
    )
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Post(":publicId/status")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Changer le statut (vendu, loué, archivé, modération...)",
    description:
      "SOLD/RENTED/ARCHIVED : gestionnaire du bien ou admin. Validation de revue : listing:moderate. Suspension : listing:suspend.",
  })
  @ApiOkResponse({ type: ListingResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409, 422)
  async changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: ChangeListingStatusDto,
    @Client() client: ClientContext,
  ): Promise<ListingResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.listings.changeStatus(
      actor,
      publicId,
      {
        status: dto.status,
        ...(dto.reason ? { reason: dto.reason } : {}),
        ...(dto.expiresAt ? { expiresAt: dto.expiresAt } : {}),
      },
      client,
    )
    return serializeListing(await this.queries.getOne(actor, publicId))
  }

  @Delete(":publicId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Permissions("listing:delete")
  @ApiOperation({
    summary:
      "Supprimer une annonce (archivée puis masquée, historique conservé)",
  })
  @ApiNoContentResponse()
  @CatalogApiErrors(400, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Client() client: ClientContext,
  ): Promise<void> {
    const actor = await this.actors.resolve(user)
    await this.listings.remove(actor, publicId, client)
  }
}
