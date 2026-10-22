import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  BUDGET_PERIODS,
  LISTING_TYPES,
  RECOMMENDATION_FEEDBACK_TYPES,
  type BudgetPeriod,
  type ListingType,
  type RecommendationFeedbackType,
} from "@mon-appart/types"
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator"

import { CODE_PATTERN } from "../../../property"
import type { RawRecommendationParams } from "../../application/recommendation.service"
import type { PreferenceInput } from "../../application/preference.service"

/** Paramètres d'URL reçus comme chaînes ; validés par le service (codes d'erreur précis). */
export class RecommendationQueryDto implements RawRecommendationParams {
  @ApiPropertyOptional({
    description:
      "Filtre strict : RENT, SALE, SHORT_TERM_RENT, LEASE_TO_OWN (liste). Par défaut : types déclarés dans les préférences.",
    example: "RENT",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  listingType?: string

  @ApiPropertyOptional({
    description: "Filtre strict : codes de types de biens (liste).",
    example: "APARTMENT",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  propertyType?: string

  @ApiPropertyOptional({
    description: "Filtre strict : codes de villes.",
    example: "ABIDJAN",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string

  @ApiPropertyOptional({ description: "1 à 50, 20 par défaut.", example: "20" })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  limit?: string

  @ApiPropertyOptional({ description: "Curseur opaque de la page précédente." })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string
}

export class SimilarQueryDto implements Pick<
  RawRecommendationParams,
  "limit" | "cursor"
> {
  @ApiPropertyOptional({ description: "1 à 50, 20 par défaut.", example: "10" })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  limit?: string

  @ApiPropertyOptional({ description: "Curseur opaque de la page précédente." })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string
}

export class RecommendationFeedbackDto {
  @ApiProperty({
    enum: RECOMMENDATION_FEEDBACK_TYPES,
    example: "NOT_INTERESTED",
    description:
      "DISPLAYED et CLICKED mesurent l'exposition ; les autres expriment un avis. NOT_INTERESTED, IRRELEVANT, WRONG_BUDGET et WRONG_LOCATION écartent l'annonce des prochaines listes.",
  })
  @IsIn(RECOMMENDATION_FEEDBACK_TYPES)
  type!: RecommendationFeedbackType
}

const Code = () => Matches(CODE_PATTERN, { each: true })

/** Remplacement complet : un champ absent est effacé. */
export class UpdatePreferencesDto implements PreferenceInput {
  @ApiPropertyOptional({
    enum: LISTING_TYPES,
    isArray: true,
    example: ["RENT"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(LISTING_TYPES, { each: true })
  listingTypes?: ListingType[]

  @ApiPropertyOptional({ type: Number, nullable: true, example: 150_000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999)
  minBudget?: number | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 300_000,
    description: "Plafond strict, sauf tolérance explicite.",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(999_999_999_999)
  maxBudget?: number | null

  @ApiPropertyOptional({
    example: "XOF",
    description: "ISO 4217, XOF par défaut.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string

  @ApiPropertyOptional({
    enum: BUDGET_PERIODS,
    nullable: true,
    example: "MONTH",
    description:
      "Obligatoire si elle ne se déduit pas des types d'offre (location → MONTH, vente → TOTAL, courte durée → DAY).",
  })
  @IsOptional()
  @IsIn(BUDGET_PERIODS)
  budgetPeriod?: BudgetPeriod | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 30,
    example: 10,
    description: "Dépassement accepté du maximum, en %.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  budgetTolerancePct?: number | null

  @ApiPropertyOptional({ type: [String], example: ["APARTMENT", "VILLA"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Code()
  propertyTypes?: string[]

  @ApiPropertyOptional({ type: [String], example: ["COCODY"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Code()
  communes?: string[]

  @ApiPropertyOptional({ type: [String], example: ["RIVIERA"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Code()
  neighborhoods?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ["PARKING", "AIR_CONDITIONING"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Code()
  amenities?: string[]

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: 60 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  minSurface?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: 120 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  maxSurface?: number | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 5.3599,
    description: "Point de référence (travail, école), avec longitude.",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: -3.9875 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 5,
    description: "km, 5 par défaut.",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(100)
  radiusKm?: number | null
}
