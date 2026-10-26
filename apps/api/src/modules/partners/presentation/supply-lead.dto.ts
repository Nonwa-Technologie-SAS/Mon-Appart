import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

export enum SupplyLeadSegmentDto {
  OWNER = "OWNER",
  SMALL_AGENCY = "SMALL_AGENCY",
  ESTABLISHED_AGENCY = "ESTABLISHED_AGENCY",
  DEVELOPER = "DEVELOPER",
  PROPERTY_MANAGER = "PROPERTY_MANAGER",
  LAND_SPECIALIST = "LAND_SPECIALIST",
  OTHER = "OTHER",
}

export enum SupplyLeadStageDto {
  IDENTIFIED = "IDENTIFIED",
  TO_CONTACT = "TO_CONTACT",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  DEMO = "DEMO",
  REGISTERED = "REGISTERED",
  LISTINGS_SUBMITTED = "LISTINGS_SUBMITTED",
  VERIFICATION = "VERIFICATION",
  FIRST_PUBLISHED = "FIRST_PUBLISHED",
  ACTIVATED = "ACTIVATED",
  NURTURE = "NURTURE",
  REFUSED = "REFUSED",
  CHURN_RISK = "CHURN_RISK",
}

export enum SupplyLeadSourceDto {
  DIRECT = "DIRECT",
  REFERRAL = "REFERRAL",
  DIRECTORY = "DIRECTORY",
  EVENT = "EVENT",
  WEBSITE = "WEBSITE",
  SOCIAL = "SOCIAL",
  OTHER = "OTHER",
}

export enum SupplyLeadInteractionKindDto {
  CALL = "CALL",
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  VISIT = "VISIT",
  DEMO = "DEMO",
  NOTE = "NOTE",
  STATUS_CHANGE = "STATUS_CHANGE",
}

export class CreateSupplyLeadDto {
  @ApiProperty({ enum: SupplyLeadSegmentDto })
  @IsEnum(SupplyLeadSegmentDto)
  segment!: SupplyLeadSegmentDto

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  organizationName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zoneCodes?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyCategories?: string[]

  @ApiPropertyOptional({ enum: SupplyLeadSourceDto })
  @IsOptional()
  @IsEnum(SupplyLeadSourceDto)
  source?: SupplyLeadSourceDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  estimatedListings?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextActionAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  partnerPublicId?: string
}

export class UpdateSupplyLeadDto {
  @ApiPropertyOptional({ enum: SupplyLeadSegmentDto })
  @IsOptional()
  @IsEnum(SupplyLeadSegmentDto)
  segment?: SupplyLeadSegmentDto

  @ApiPropertyOptional({ enum: SupplyLeadStageDto })
  @IsOptional()
  @IsEnum(SupplyLeadStageDto)
  stage?: SupplyLeadStageDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  organizationName?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zoneCodes?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyCategories?: string[]

  @ApiPropertyOptional({ enum: SupplyLeadSourceDto })
  @IsOptional()
  @IsEnum(SupplyLeadSourceDto)
  source?: SupplyLeadSourceDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  estimatedListings?: number | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  submittedListings?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  approvedListings?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  activeListings?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextActionAt?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  refusalReason?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  partnerPublicId?: string | null
}

export class AddSupplyLeadInteractionDto {
  @ApiProperty({ enum: SupplyLeadInteractionKindDto })
  @IsEnum(SupplyLeadInteractionKindDto)
  kind!: SupplyLeadInteractionKindDto

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  summary!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string
}
