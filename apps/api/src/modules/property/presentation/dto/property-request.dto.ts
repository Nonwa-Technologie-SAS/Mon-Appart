import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from "@nestjs/swagger"
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator"

import {
  LocationVisibility,
  OwnershipType,
  PropertyStatus,
} from "../../../../generated/prisma/enums"

export const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

/** `null` refusé : le champ est obligatoire sur la ressource. */
const NotNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined)

export class CreatePropertyDto {
  @ApiProperty({ example: "VILLA", description: "Code de GET /property-types" })
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  propertyType: string

  @ApiProperty({ example: "COCODY" })
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  commune: string

  @ApiProperty({ example: "RIVIERA" })
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(80)
  neighborhood: string

  @ApiProperty({ example: "Villa 4 chambres Cocody Riviera", maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 280,
    description: "Surface habitable (m²)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(99_999_999)
  surface?: number | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 600,
    description: "Surface du terrain (m²)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(9_999_999_999)
  landSurface?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: 4 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bathrooms?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  rooms?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: -5 })
  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  floor?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  totalFloors?: number | null

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1800,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2100)
  yearBuilt?: number | null

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    description: "Publique seulement si locationVisibility = EXACT",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: 5.3625 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number | null

  @ApiPropertyOptional({ type: Number, nullable: true, example: -3.9612 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number | null

  @ApiPropertyOptional({
    enum: Object.values(LocationVisibility),
    default: "APPROXIMATE",
  })
  @NotNull()
  @IsIn(Object.values(LocationVisibility))
  locationVisibility?: LocationVisibility

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    example: { parkingSpaces: 2, standing: "HAUT" },
    description:
      "Attributs secondaires, clés autorisées selon la catégorie du type",
  })
  @NotNull()
  @IsObject()
  attributes?: Record<string, unknown>

  @ApiPropertyOptional({ type: [String], example: ["PARKING", "SECURITY"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(CODE_PATTERN, { each: true })
  amenities?: string[]

  @ApiPropertyOptional({
    enum: Object.values(OwnershipType),
    description:
      "Rattachement du créateur. Défaut : SOLE, ou AGENT pour un compte agent/agence. AGENT et MANAGER sont réservés aux professionnels.",
  })
  @IsOptional()
  @IsIn(Object.values(OwnershipType))
  ownershipType?: OwnershipType
}

// skipNullProperties: false : `null` reste refusé sur les champs obligatoires
// et accepté (effacement) sur ceux déjà marqués @IsOptional.
export class UpdatePropertyDto extends PartialType(
  OmitType(CreatePropertyDto, ["amenities", "ownershipType"] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({
    enum: Object.values(PropertyStatus),
    description: "DRAFT→ACTIVE (bien complet), ACTIVE↔INACTIVE, →ARCHIVED",
  })
  @NotNull()
  @IsIn(Object.values(PropertyStatus))
  status?: PropertyStatus
}

export class ReplaceAmenitiesDto {
  @ApiProperty({ type: [String], example: ["PARKING", "GARDEN"] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(CODE_PATTERN, { each: true })
  amenities: string[]
}

export class PropertyQueryDto {
  @ApiPropertyOptional({
    enum: ["public", "mine", "all"],
    default: "public",
    description:
      "mine : biens gérés par l'utilisateur ; all : administration (property:manage)",
  })
  @IsOptional()
  @IsIn(["public", "mine", "all"])
  scope?: "public" | "mine" | "all"

  @ApiPropertyOptional({
    enum: Object.values(PropertyStatus),
    description: "Ignoré en scope public",
  })
  @IsOptional()
  @IsIn(Object.values(PropertyStatus))
  status?: PropertyStatus

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

  @ApiPropertyOptional({ description: "m², surface habitable ou du terrain" })
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

  @ApiPropertyOptional({
    description: "Recherche par rayon : avec longitude et radiusKm",
  })
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

  @ApiPropertyOptional({ description: "nextCursor de la page précédente" })
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
