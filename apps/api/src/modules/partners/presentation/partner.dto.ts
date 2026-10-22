import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator"

export enum PartnerCategoryDto {
  AGENCY = "AGENCY",
  DEVELOPER = "DEVELOPER",
  PROPERTY_MANAGER = "PROPERTY_MANAGER",
  SERVICE_PROVIDER = "SERVICE_PROVIDER",
  PAYMENT = "PAYMENT",
  COMMUNICATION = "COMMUNICATION",
  GEOCODING = "GEOCODING",
  ANALYTICS = "ANALYTICS",
  OTHER = "OTHER",
}

export enum PartnerCommercialStatusDto {
  PROSPECT = "PROSPECT",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  ENDED = "ENDED",
}

export enum PartnerIntegrationStatusDto {
  PLANNED = "PLANNED",
  INTEGRATING = "INTEGRATING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  RETIRED = "RETIRED",
}

export enum PartnerIntegrationKindDto {
  MANUAL = "MANUAL",
  CSV_IMPORT = "CSV_IMPORT",
  WEBHOOK_IN = "WEBHOOK_IN",
  API = "API",
  SDK = "SDK",
}

export class CreatePartnerDto {
  @ApiProperty({ example: "agence-exemple" })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @ApiProperty({ enum: PartnerCategoryDto })
  @IsEnum(PartnerCategoryDto)
  category!: PartnerCategoryDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ enum: PartnerCommercialStatusDto })
  @IsOptional()
  @IsEnum(PartnerCommercialStatusDto)
  commercialStatus?: PartnerCommercialStatusDto
}

export class UpdatePartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @ApiPropertyOptional({ enum: PartnerCommercialStatusDto })
  @IsOptional()
  @IsEnum(PartnerCommercialStatusDto)
  commercialStatus?: PartnerCommercialStatusDto
}

export class CreateWebhookOutDto {
  @ApiProperty({ example: "https://partner.example.com/hooks/mon-appart" })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  webhookUrl!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activate?: boolean
}

export class SetIntegrationStatusDto {
  @ApiProperty({ enum: PartnerIntegrationStatusDto })
  @IsEnum(PartnerIntegrationStatusDto)
  status!: PartnerIntegrationStatusDto
}

export class CreateIntegrationStubDto {
  @ApiProperty({ enum: PartnerIntegrationKindDto })
  @IsEnum(PartnerIntegrationKindDto)
  kind!: PartnerIntegrationKindDto

  @ApiPropertyOptional({ enum: PartnerIntegrationStatusDto })
  @IsOptional()
  @IsEnum(PartnerIntegrationStatusDto)
  status?: PartnerIntegrationStatusDto
}

export class ValidateCsvImportDto {
  @ApiProperty({ example: "annonces.csv" })
  @IsString()
  @MaxLength(255)
  filename!: string

  @ApiProperty({ description: "Contenu CSV texte (pas un binaire)" })
  @IsString()
  @MinLength(10)
  @MaxLength(2_000_000)
  csv!: string

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean
}
