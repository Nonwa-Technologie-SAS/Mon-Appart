import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  LISTING_TYPES,
  SEARCH_SORTS,
  SUGGESTION_TYPES,
  type SearchResponse,
  type SuggestionResponse,
} from "@mon-appart/types"

class CodeNameDto {
  @ApiProperty() code!: string
  @ApiProperty() name!: string
}

class SearchPriceDto {
  @ApiProperty() amount!: number
  @ApiProperty({ example: "XOF" }) currency!: string
  @ApiProperty({ example: "MONTH" }) period!: string
}

class SearchLocationDto {
  @ApiProperty({ type: CodeNameDto }) city!: CodeNameDto
  @ApiProperty({ type: CodeNameDto }) commune!: CodeNameDto
  @ApiProperty({ type: CodeNameDto }) neighborhood!: CodeNameDto
  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Position publiée (arrondie si APPROXIMATE).",
  })
  latitude!: number | null
  @ApiProperty({ type: Number, nullable: true }) longitude!: number | null
  @ApiProperty({ enum: ["EXACT", "APPROXIMATE", "NONE"] }) precision!:
    "EXACT" | "APPROXIMATE" | "NONE"
}

class SearchDistanceDto {
  @ApiProperty({ description: "Arrondi à 0,1 km." }) value!: number
  @ApiProperty({ enum: ["km"] }) unit!: "km"
}

export class SearchResultItemDto {
  @ApiProperty({ format: "uuid" }) listingId!: string
  @ApiProperty({ format: "uuid" }) propertyId!: string
  @ApiProperty() title!: string
  @ApiProperty({ enum: LISTING_TYPES })
  listingType!: (typeof LISTING_TYPES)[number]
  @ApiProperty({ type: CodeNameDto }) propertyType!: CodeNameDto
  @ApiProperty({ type: SearchPriceDto, nullable: true })
  price!: SearchPriceDto | null
  @ApiProperty({ type: Number, nullable: true }) surface!: number | null
  @ApiProperty({ type: Number, nullable: true }) landSurface!: number | null
  @ApiProperty({ type: Number, nullable: true }) bedrooms!: number | null
  @ApiProperty({ type: Number, nullable: true }) bathrooms!: number | null
  @ApiProperty({ type: SearchLocationDto }) location!: SearchLocationDto
  @ApiProperty({ type: String, nullable: true }) mainImage!: string | null
  @ApiProperty({
    type: Number,
    nullable: true,
    description: "0..1, tri RELEVANCE uniquement.",
  })
  score!: number | null
  @ApiProperty({ type: SearchDistanceDto, nullable: true })
  distance!: SearchDistanceDto | null
  @ApiProperty({ format: "date-time" }) publishedAt!: string
}

class PaginationDto {
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null
  @ApiProperty() hasMore!: boolean
  @ApiProperty() limit!: number
}

class TotalDto {
  @ApiProperty({ type: Number, nullable: true }) value!: number | null
  @ApiProperty({
    enum: ["exact", "estimated", "not_available"],
    description:
      "estimated : au moins `value` (plafond 1000) ; not_available : pages suivantes.",
  })
  strategy!: "exact" | "estimated" | "not_available"
}

class FacetBucketDto {
  @ApiProperty() value!: string
  @ApiProperty() label!: string
  @ApiProperty() count!: number
}

class PriceRangeBucketDto {
  @ApiProperty({ type: Number, nullable: true }) min!: number | null
  @ApiProperty({ type: Number, nullable: true }) max!: number | null
  @ApiProperty() count!: number
}

class SearchFacetsDto {
  @ApiPropertyOptional({ type: [FacetBucketDto] })
  propertyTypes?: FacetBucketDto[]
  @ApiPropertyOptional({ type: [FacetBucketDto] })
  listingTypes?: FacetBucketDto[]
  @ApiPropertyOptional({ type: [FacetBucketDto] }) cities?: FacetBucketDto[]
  @ApiPropertyOptional({ type: [FacetBucketDto] }) communes?: FacetBucketDto[]
  @ApiPropertyOptional({ type: [FacetBucketDto] })
  neighborhoods?: FacetBucketDto[]
  @ApiPropertyOptional({ type: [PriceRangeBucketDto] })
  priceRanges?: PriceRangeBucketDto[]
  @ApiPropertyOptional({ type: [FacetBucketDto] }) bedrooms?: FacetBucketDto[]
  @ApiPropertyOptional({ type: [FacetBucketDto] }) amenities?: FacetBucketDto[]
}

class SearchMetaDto {
  @ApiProperty({ enum: SEARCH_SORTS }) sort!: (typeof SEARCH_SORTS)[number]
  @ApiProperty({ enum: ["postgres", "opensearch"] }) engine!:
    "postgres" | "opensearch"
  @ApiProperty({
    description: "Moteur configuré indisponible, réponse PostgreSQL.",
  })
  degraded!: boolean
  @ApiProperty({ description: "Tolérance aux fautes appliquée." })
  fuzzy!: boolean
}

class RelaxedFilterDto {
  @ApiProperty() filter!: string
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "string", nullable: true },
  })
  params!: Record<string, string | null>
  @ApiProperty() label!: string
}

class ZeroResultsDto {
  @ApiProperty({ type: [String] }) suggestions!: string[]
  @ApiProperty({ type: [RelaxedFilterDto] }) relaxedFilters!: RelaxedFilterDto[]
}

export class SearchResponseDto implements SearchResponse {
  @ApiProperty({ type: [SearchResultItemDto] }) items!: SearchResultItemDto[]
  @ApiProperty({ type: PaginationDto }) pagination!: PaginationDto
  @ApiProperty({ type: TotalDto }) total!: TotalDto
  @ApiPropertyOptional({ type: SearchFacetsDto }) facets?: SearchFacetsDto
  @ApiProperty({ type: SearchMetaDto }) meta!: SearchMetaDto
  @ApiPropertyOptional({ type: ZeroResultsDto }) zeroResults?: ZeroResultsDto
}

class SuggestionDto {
  @ApiProperty({ enum: SUGGESTION_TYPES })
  type!: (typeof SUGGESTION_TYPES)[number]
  @ApiProperty() label!: string
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "string" },
    description: "Paramètres de recherche à appliquer.",
  })
  params!: Record<string, string>
}

export class SuggestionResponseDto implements SuggestionResponse {
  @ApiProperty({ type: [SuggestionDto] }) items!: SuggestionDto[]
}
