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
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ActorService,
  CurrentUser,
  type AuthenticatedUser,
} from "../../identity"
import { SavedSearchService } from "../application/saved-search.service"
import { searchRateLimit } from "../search.config"
import {
  CreateSavedSearchDto,
  ProjectStatusResponseDto,
  ResumeSavedSearchResponseDto,
  SavedSearchListResponseDto,
  SavedSearchResponseDto,
  UpdateProjectStatusDto,
  UpdateSavedSearchDto,
} from "./dto/saved-search.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000

@ApiTags("saved-searches")
@ApiBearerAuth()
@Controller({ path: "saved-searches", version: "1" })
export class SavedSearchController {
  constructor(
    private readonly actors: ActorService,
    private readonly savedSearches: SavedSearchService,
  ) {}

  @Get()
  @Throttle({ default: { limit: searchRateLimit, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Mes recherches enregistrées" })
  @ApiOkResponse({ type: SavedSearchListResponseDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SavedSearchListResponseDto> {
    const actor = await this.actors.resolve(user)
    return { items: await this.savedSearches.list(actor) }
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: "Enregistrer une recherche",
    description:
      "Les recherches temporaires ne sont pas sauvegardées automatiquement. Les alertes exigent au moins un filtre structuré.",
  })
  @ApiCreatedResponse({ type: SavedSearchResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedSearchDto,
  ): Promise<SavedSearchResponseDto> {
    const actor = await this.actors.resolve(user)
    return this.savedSearches.create(actor, dto)
  }

  @Patch(":savedSearchId")
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Modifier une recherche enregistrée" })
  @ApiOkResponse({ type: SavedSearchResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("savedSearchId", uuid) savedSearchId: string,
    @Body() dto: UpdateSavedSearchDto,
  ): Promise<SavedSearchResponseDto> {
    const actor = await this.actors.resolve(user)
    return this.savedSearches.update(actor, savedSearchId, dto)
  }

  @Delete(":savedSearchId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Supprimer une recherche enregistrée" })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("savedSearchId", uuid) savedSearchId: string,
  ): Promise<void> {
    const actor = await this.actors.resolve(user)
    await this.savedSearches.remove(actor, savedSearchId)
  }

  @Post(":savedSearchId/resume")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  @ApiOperation({ summary: "Relancer une recherche enregistrée" })
  @ApiOkResponse({ type: ResumeSavedSearchResponseDto })
  async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param("savedSearchId", uuid) savedSearchId: string,
  ): Promise<ResumeSavedSearchResponseDto> {
    const actor = await this.actors.resolve(user)
    return this.savedSearches.resume(actor, savedSearchId)
  }
}

@ApiTags("retention")
@ApiBearerAuth()
@Controller({ path: "retention", version: "1" })
export class RetentionController {
  constructor(
    private readonly actors: ActorService,
    private readonly savedSearches: SavedSearchService,
  ) {}

  @Get("project")
  @ApiOperation({
    summary: "Statut déclaré de mon projet immobilier",
    description:
      "ACTIVE, PAUSED ou COMPLETED. Une inactivité ne bascule jamais ce statut.",
  })
  @ApiOkResponse({ type: ProjectStatusResponseDto })
  async getProject(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectStatusResponseDto> {
    const actor = await this.actors.resolve(user)
    return this.savedSearches.projectStatus(actor)
  }

  @Patch("project")
  @ApiOperation({ summary: "Déclarer l'état de mon projet" })
  @ApiOkResponse({ type: ProjectStatusResponseDto })
  async setProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectStatusDto,
  ): Promise<ProjectStatusResponseDto> {
    const actor = await this.actors.resolve(user)
    return this.savedSearches.setProjectStatus(actor, dto.projectStatus)
  }
}
