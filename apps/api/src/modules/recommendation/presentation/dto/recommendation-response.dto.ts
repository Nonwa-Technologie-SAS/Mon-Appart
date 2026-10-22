import { ApiProperty } from "@nestjs/swagger"
import {
  BUDGET_PERIODS,
  LISTING_TYPES,
  RECOMMENDATION_CONTEXTS,
  RECOMMENDATION_REASON_LABELS,
  type BudgetPeriod,
  type ListingType,
  type RecommendationContext,
  type RecommendationLevel,
  type RecommendationPreferences,
  type RecommendationReasonCode,
  type RecommendationResponse,
} from "@mon-appart/types"

import { SearchResultItemDto } from "../../../search"

const REASON_CODES = Object.keys(RECOMMENDATION_REASON_LABELS)

class RecommendationReasonDto {
  @ApiProperty({ enum: REASON_CODES, example: "BUDGET_MATCH" })
  code!: RecommendationReasonCode
  @ApiProperty({ example: "Dans votre budget" }) label!: string
}

class RecommendationItemDto {
  @ApiProperty({
    type: String,
    format: "uuid",
    nullable: true,
    description: "À renvoyer avec un retour. `null` pour un visiteur.",
  })
  id!: string | null
  @ApiProperty({ enum: RECOMMENDATION_CONTEXTS })
  context!: RecommendationContext
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    example: 87,
    description: "Adéquation au profil, pas une note de l'annonce.",
  })
  score!: number
  @ApiProperty({ type: [RecommendationReasonDto], maxItems: 3 })
  reasons!: RecommendationReasonDto[]
  @ApiProperty({ type: SearchResultItemDto }) listing!: SearchResultItemDto
  @ApiProperty({ format: "date-time" }) generatedAt!: string
}

class RecommendationPaginationDto {
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null
  @ApiProperty() hasMore!: boolean
  @ApiProperty() limit!: number
}

class RecommendationMetaDto {
  @ApiProperty({ enum: RECOMMENDATION_CONTEXTS })
  context!: RecommendationContext
  @ApiProperty({
    enum: ["GENERIC", "PREFERENCES", "BEHAVIOR"],
    description:
      "GENERIC : aucun signal ; PREFERENCES : préférences déclarées ; BEHAVIOR : activité prise en compte.",
  })
  level!: RecommendationLevel
  @ApiProperty({ example: "rules-v1" }) algorithmVersion!: string
  @ApiProperty({
    description: "Moteur distant indisponible, règles appliquées.",
  })
  degraded!: boolean
  @ApiProperty({
    format: "uuid",
    description:
      "Identifiant de la page servie, repris par les événements analytiques (affichage, ouverture).",
  })
  requestId!: string
}

export class RecommendationResponseDto implements RecommendationResponse {
  @ApiProperty({ type: [RecommendationItemDto] })
  items!: RecommendationItemDto[]
  @ApiProperty({ type: RecommendationPaginationDto })
  pagination!: RecommendationPaginationDto
  @ApiProperty({ type: RecommendationMetaDto }) meta!: RecommendationMetaDto
}

class BudgetDto {
  @ApiProperty({ type: Number, nullable: true, example: 150_000 }) min!:
    number | null
  @ApiProperty({ type: Number, nullable: true, example: 300_000 }) max!:
    number | null
  @ApiProperty({ example: "XOF" }) currency!: string
  @ApiProperty({ enum: BUDGET_PERIODS, nullable: true, example: "MONTH" })
  period!: BudgetPeriod | null
  @ApiProperty({ example: 10 }) tolerancePct!: number
}

class SurfaceRangeDto {
  @ApiProperty({ type: Number, nullable: true }) min!: number | null
  @ApiProperty({ type: Number, nullable: true }) max!: number | null
}

class PreferencePointDto {
  @ApiProperty() latitude!: number
  @ApiProperty() longitude!: number
  @ApiProperty({ example: 5 }) radiusKm!: number
}

export class RecommendationPreferencesDto implements RecommendationPreferences {
  @ApiProperty({ enum: LISTING_TYPES, isArray: true })
  listingTypes!: ListingType[]
  @ApiProperty({ type: BudgetDto }) budget!: BudgetDto
  @ApiProperty({ type: [String], example: ["APARTMENT"] })
  propertyTypes!: string[]
  @ApiProperty({ type: [String], example: ["COCODY"] }) communes!: string[]
  @ApiProperty({ type: [String], example: ["RIVIERA"] })
  neighborhoods!: string[]
  @ApiProperty({ type: [String], example: ["PARKING"] }) amenities!: string[]
  @ApiProperty({ type: Number, nullable: true, example: 2 }) bedrooms!:
    number | null
  @ApiProperty({ type: Number, nullable: true }) bathrooms!: number | null
  @ApiProperty({ type: SurfaceRangeDto }) surface!: SurfaceRangeDto
  @ApiProperty({ type: PreferencePointDto, nullable: true })
  point!: PreferencePointDto | null
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  updatedAt!: string | null
}
