import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import {
  ListingStatus,
  ListingType,
  PricePeriod,
} from "../../../../generated/prisma/enums"
import { CODE_PATTERN } from "../../../property"
import { MAX_AMOUNT, SUPPORTED_CURRENCIES } from "../../domain/listing-price"

const NotNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined)

export class PriceDto {
  @ApiProperty({
    example: 1_500_000,
    description: "Montant entier en XOF (pas de centimes), strictement positif",
    minimum: 1,
    maximum: MAX_AMOUNT,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT)
  amount: number

  @ApiProperty({
    enum: Object.values(PricePeriod),
    description:
      "SALE : TOTAL ; RENT : MONTH/YEAR ; SHORT_TERM_RENT : DAY/WEEK/MONTH ; LEASE_TO_OWN : MONTH",
  })
  @IsIn(Object.values(PricePeriod))
  period: PricePeriod

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, default: "XOF" })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: string
}

export class CreateListingDto {
  @ApiProperty({ format: "uuid", description: "Identifiant public du bien" })
  @IsUUID("4")
  propertyId: string

  @ApiProperty({ enum: Object.values(ListingType) })
  @IsIn(Object.values(ListingType))
  listingType: ListingType

  @ApiPropertyOptional({
    maxLength: 200,
    description: "Titre du bien par défaut",
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null

  @ApiPropertyOptional({
    type: PriceDto,
    description: "Obligatoire avant publication",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceDto)
  price?: PriceDto
}

export class UpdateListingDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @NotNull()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description:
      "Annonce publiée ou en pause : nouvelle échéance (1 h à 365 j)",
  })
  @NotNull()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date
}

export class ChangeListingPriceDto extends PriceDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

export class PublishListingDto {
  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description:
      "Échéance (1 h à 365 j). Par défaut : LISTING_DEFAULT_DURATION_DAYS",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date
}

export class PauseListingDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

export class ChangeListingStatusDto {
  @ApiProperty({
    enum: Object.values(ListingStatus),
    description:
      "Transitions validées par la matrice (voir docs/property-listing.md)",
  })
  @IsIn(Object.values(ListingStatus))
  status: ListingStatus

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "Vers PUBLISHED uniquement",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date
}

export class ListingQueryDto {
  @ApiPropertyOptional({
    enum: ["public", "mine", "all"],
    default: "public",
    description:
      "mine : annonces des biens gérés ; all : administration / modération",
  })
  @IsOptional()
  @IsIn(["public", "mine", "all"])
  scope?: "public" | "mine" | "all"

  @ApiPropertyOptional({
    enum: Object.values(ListingStatus),
    description: "Ignoré en scope public",
  })
  @IsOptional()
  @IsIn(Object.values(ListingStatus))
  status?: ListingStatus

  @ApiPropertyOptional({ enum: Object.values(ListingType) })
  @IsOptional()
  @IsIn(Object.values(ListingType))
  listingType?: ListingType

  @ApiPropertyOptional({ example: "VILLA" })
  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  propertyType?: string

  @ApiPropertyOptional({ example: "COCODY" })
  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  commune?: string

  @ApiPropertyOptional({ example: "RIVIERA", description: "Exige commune" })
  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  neighborhood?: string

  @ApiPropertyOptional({ description: "Prix courant minimum (XOF)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number

  @ApiPropertyOptional({ description: "Prix courant maximum (XOF)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number

  @ApiPropertyOptional({ enum: Object.values(PricePeriod) })
  @IsOptional()
  @IsIn(Object.values(PricePeriod))
  period?: PricePeriod

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSurface?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSurface?: number

  @ApiPropertyOptional({ description: "Au moins N chambres" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms?: number

  @ApiPropertyOptional({ description: "Au moins N salles de bain" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bathrooms?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number

  @ApiPropertyOptional({ minimum: 0.5, maximum: 50, example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
