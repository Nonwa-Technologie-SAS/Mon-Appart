import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  type AuthenticatedUser,
  type ClientContext,
} from "../../../identity"
import { messagingRateLimit } from "../../communication.config"
import { CommunicationApiErrors } from "../../presentation/communication-api-errors"
import { InquiryService } from "../application/inquiry.service"
import {
  AddInquiryNoteDto,
  InquiryListQueryDto,
  UpdateInquiryDto,
} from "./inquiry.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const writeLimit = { default: { limit: messagingRateLimit, ttl: 60_000 } }

@ApiTags("inquiries")
@ApiBearerAuth()
@Controller({ path: "inquiries", version: "1" })
export class InquiryController {
  constructor(
    private readonly actors: ActorService,
    private readonly inquiries: InquiryService,
  ) {}

  @Get("dashboard")
  @ApiOperation({
    summary: "Indicateurs commerciaux de mes biens",
    description:
      "Agrégats calculés sur les demandes et visites réelles. Aucun chiffre de démonstration.",
  })
  @ApiOkResponse()
  @CommunicationApiErrors(401)
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    const actor = await this.actors.resolve(user)
    return this.inquiries.dashboard(actor)
  }

  @Get()
  @ApiOperation({
    summary: "Boîte de réception des demandes (côté annonce)",
    description:
      "Uniquement les biens dont l’appelant est gestionnaire courant. Le prospect n’y a pas accès.",
  })
  @ApiOkResponse()
  @CommunicationApiErrors(400, 401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InquiryListQueryDto,
  ) {
    const actor = await this.actors.resolve(user)
    return this.inquiries.list(actor, query)
  }

  @Get(":inquiryId")
  @ApiOperation({ summary: "Fiche lead (notes internes incluses)" })
  @ApiOkResponse()
  @CommunicationApiErrors(401, 404)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("inquiryId", uuid) inquiryId: string,
  ) {
    const actor = await this.actors.resolve(user)
    return this.inquiries.get(actor, inquiryId)
  }

  @Patch(":inquiryId")
  @Throttle(writeLimit)
  @ApiOperation({ summary: "Mettre à jour le suivi commercial" })
  @ApiOkResponse()
  @CommunicationApiErrors(400, 401, 404, 422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("inquiryId", uuid) inquiryId: string,
    @Body() dto: UpdateInquiryDto,
    @Client() client: ClientContext,
  ) {
    const actor = await this.actors.resolve(user)
    return this.inquiries.update(actor, inquiryId, dto, client)
  }

  @Post(":inquiryId/notes")
  @HttpCode(HttpStatus.CREATED)
  @Throttle(writeLimit)
  @ApiOperation({
    summary: "Ajouter une note interne",
    description: "Jamais visible du prospect, jamais envoyée en conversation.",
  })
  @ApiOkResponse()
  @CommunicationApiErrors(400, 401, 404, 422)
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("inquiryId", uuid) inquiryId: string,
    @Body() dto: AddInquiryNoteDto,
    @Client() client: ClientContext,
  ) {
    const actor = await this.actors.resolve(user)
    return this.inquiries.addNote(actor, inquiryId, dto.body, client)
  }
}
