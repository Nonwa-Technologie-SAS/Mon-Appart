import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"

import { Public } from "../../identity"
import { BadgeService } from "../application/badge.service"
import {
  ListingBadgesResponseDto,
  UserBadgesResponseDto,
} from "./dto/trust-response.dto"
import { TrustApiErrors } from "./trust-api-errors"
import { serialize } from "./trust.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })

/**
 * Badges publics : faits examinés et datés, accompagnés d'un avertissement.
 * Jamais de score, de signal ni de détail de dossier.
 */
@ApiTags("trust")
@Public()
@Controller({ path: "trust", version: "1" })
export class BadgeController {
  constructor(private readonly badges: BadgeService) {}

  @Get("listings/:listingId/badges")
  @ApiOperation({
    summary: "Badges de confiance d'une annonce publiée",
    description:
      "Droit de publication, documents du bien et contrôle d'annonce vérifiés et valides, plus les badges du publiant. Aucun badge sans vérification approuvée.",
  })
  @ApiOkResponse({ type: ListingBadgesResponseDto })
  @TrustApiErrors(400, 404)
  async listing(
    @Param("listingId", uuid) listingId: string,
  ): Promise<ListingBadgesResponseDto> {
    return serialize(await this.badges.forListing(listingId))
  }

  @Get("users/:userId/badges")
  @ApiOperation({ summary: "Badges de confiance d'un utilisateur" })
  @ApiOkResponse({ type: UserBadgesResponseDto })
  @TrustApiErrors(400, 404)
  async user(
    @Param("userId", uuid) userId: string,
  ): Promise<UserBadgesResponseDto> {
    return serialize(await this.badges.forUser(userId))
  }
}
