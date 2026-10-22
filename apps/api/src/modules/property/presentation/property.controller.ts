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
import { PropertyQueryService } from "../application/property-query.service"
import { PropertyService } from "../application/property.service"
import { CatalogApiErrors } from "./catalog-api-errors"
import {
  CreatePropertyDto,
  PropertyQueryDto,
  ReplaceAmenitiesDto,
  UpdatePropertyDto,
} from "./dto/property-request.dto"
import {
  PropertyPageResponseDto,
  PropertyResponseDto,
} from "./dto/property-response.dto"
import {
  serializeProperty,
  serializePropertySummary,
} from "./property.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })

@ApiTags("properties")
@Controller({ path: "properties", version: "1" })
export class PropertyController {
  constructor(
    private readonly actors: ActorService,
    private readonly properties: PropertyService,
    private readonly queries: PropertyQueryService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @Permissions("property:create")
  @ApiOperation({
    summary: "Créer un bien (brouillon)",
    description:
      "Le créateur est rattaché au bien depuis son access token ; aucun identifiant de propriétaire n'est accepté.",
  })
  @ApiCreatedResponse({ type: PropertyResponseDto })
  @CatalogApiErrors(400, 401, 403, 422)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePropertyDto,
    @Client() client: ClientContext,
  ): Promise<PropertyResponseDto> {
    const actor = await this.actors.resolve(user)
    const publicId = await this.properties.create(actor, dto, client)
    return serializeProperty(await this.queries.getOne(actor, publicId))
  }

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Rechercher des biens (pagination par curseur)",
    description:
      "Public : biens actifs, localisation selon la confidentialité. scope=mine : biens gérés (tous statuts).",
  })
  @ApiOkResponse({ type: PropertyPageResponseDto })
  @CatalogApiErrors(400, 401, 403, 422)
  async list(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Query() query: PropertyQueryDto,
  ): Promise<PropertyPageResponseDto> {
    const actor = await this.actors.resolveOptional(user)
    const page = await this.queries.list(actor, query)
    return {
      items: page.items.map((row) => serializePropertySummary(row, page.mode)),
      nextCursor: page.nextCursor,
    }
  }

  @Get(":publicId")
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Fiche d'un bien",
    description:
      "Vue privée (statut, adresse, complétude) pour les gestionnaires ; vue publique pour un bien actif ; 404 sinon.",
  })
  @ApiOkResponse({ type: PropertyResponseDto })
  @CatalogApiErrors(400, 404)
  async get(
    @OptionalUser() user: AuthenticatedUser | undefined,
    @Param("publicId", uuid) publicId: string,
  ): Promise<PropertyResponseDto> {
    const actor = await this.actors.resolveOptional(user)
    return serializeProperty(await this.queries.getOne(actor, publicId))
  }

  @Patch(":publicId")
  @ApiBearerAuth()
  @Permissions("property:update")
  @ApiOperation({
    summary: "Modifier un bien (propriétaire, mandataire ou admin)",
  })
  @ApiOkResponse({ type: PropertyResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: UpdatePropertyDto,
    @Client() client: ClientContext,
  ): Promise<PropertyResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.properties.update(actor, publicId, dto, client)
    return serializeProperty(await this.queries.getOne(actor, publicId))
  }

  @Delete(":publicId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Permissions("property:delete")
  @ApiOperation({
    summary: "Supprimer un bien (suppression logique)",
    description:
      "Réservé aux titulaires de droits réels ou à l'admin. Refusé si une annonce est en cours.",
  })
  @ApiNoContentResponse()
  @CatalogApiErrors(400, 401, 403, 404, 409)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Client() client: ClientContext,
  ): Promise<void> {
    const actor = await this.actors.resolve(user)
    await this.properties.remove(actor, publicId, client)
  }

  @Put(":publicId/amenities")
  @ApiBearerAuth()
  @Permissions("property:update")
  @ApiOperation({ summary: "Remplacer les équipements du bien" })
  @ApiOkResponse({ type: PropertyResponseDto })
  @CatalogApiErrors(400, 401, 403, 404, 409, 422)
  async replaceAmenities(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicId", uuid) publicId: string,
    @Body() dto: ReplaceAmenitiesDto,
    @Client() client: ClientContext,
  ): Promise<PropertyResponseDto> {
    const actor = await this.actors.resolve(user)
    await this.properties.replaceAmenities(
      actor,
      publicId,
      dto.amenities,
      client,
    )
    return serializeProperty(await this.queries.getOne(actor, publicId))
  }
}
