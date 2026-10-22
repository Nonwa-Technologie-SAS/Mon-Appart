import { Controller, Get } from "@nestjs/common"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"

import { Public } from "../../identity"
import { PropertyQueryService } from "../application/property-query.service"
import {
  AmenityResponseDto,
  PropertyTypeResponseDto,
} from "./dto/property-response.dto"

@ApiTags("properties")
@Public()
@Controller({ version: "1" })
export class CatalogController {
  constructor(private readonly queries: PropertyQueryService) {}

  @Get("property-types")
  @ApiOperation({ summary: "Types de bien actifs" })
  @ApiOkResponse({ type: [PropertyTypeResponseDto] })
  async propertyTypes(): Promise<PropertyTypeResponseDto[]> {
    const types = await this.queries.propertyTypes()
    return types.map(({ code, name, category }) => ({ code, name, category }))
  }

  @Get("amenities")
  @ApiOperation({ summary: "Équipements, par catégorie" })
  @ApiOkResponse({ type: [AmenityResponseDto] })
  async amenities(): Promise<AmenityResponseDto[]> {
    const amenities = await this.queries.amenities()
    return amenities.map(({ code, name, category }) => ({
      code,
      name,
      category,
    }))
  }
}
