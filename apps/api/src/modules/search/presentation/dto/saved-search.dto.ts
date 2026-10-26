import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator"

import {
  PROJECT_STATUSES,
  SAVED_SEARCH_FREQUENCIES,
  type ProjectStatus,
  type SavedSearchFrequency,
} from "../../application/saved-search.service"

export class CreateSavedSearchDto {
  @ApiProperty({ example: "Appartements Cocody" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "string" },
    example: { listingType: "RENT", commune: "cocody", maxPrice: "250000" },
  })
  @IsObject()
  params!: Record<string, string>

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean

  @ApiPropertyOptional({ enum: SAVED_SEARCH_FREQUENCIES, default: "DAILY" })
  @IsOptional()
  @IsIn(SAVED_SEARCH_FREQUENCIES)
  frequency?: SavedSearchFrequency
}

export class UpdateSavedSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, string>

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean

  @ApiPropertyOptional({ enum: SAVED_SEARCH_FREQUENCIES })
  @IsOptional()
  @IsIn(SAVED_SEARCH_FREQUENCIES)
  frequency?: SavedSearchFrequency
}

export class SavedSearchResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  name: string

  @ApiProperty({ type: "object", additionalProperties: { type: "string" } })
  params: Record<string, string>

  @ApiProperty({ type: String, nullable: true })
  listingType: string | null

  @ApiProperty({ type: Number, nullable: true })
  minPrice: number | null

  @ApiProperty({ type: Number, nullable: true })
  maxPrice: number | null

  @ApiProperty()
  currency: string

  @ApiProperty()
  alertsEnabled: boolean

  @ApiProperty({ enum: SAVED_SEARCH_FREQUENCIES })
  frequency: SavedSearchFrequency

  @ApiProperty({ description: "Chemin du site pour relancer la recherche" })
  resumePath: string

  @ApiProperty()
  createdAt: string

  @ApiProperty()
  updatedAt: string
}

export class SavedSearchListResponseDto {
  @ApiProperty({ type: [SavedSearchResponseDto] })
  items: SavedSearchResponseDto[]
}

export class ResumeSavedSearchResponseDto {
  @ApiProperty({ type: "object", additionalProperties: { type: "string" } })
  params: Record<string, string>

  @ApiProperty()
  resumePath: string
}

export class ProjectStatusDto {
  @ApiProperty({ enum: PROJECT_STATUSES })
  @IsIn(PROJECT_STATUSES)
  projectStatus!: ProjectStatus
}

export class ProjectStatusResponseDto {
  @ApiProperty({ enum: PROJECT_STATUSES })
  projectStatus: ProjectStatus

  @ApiProperty({ type: String, nullable: true })
  projectCompletedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  lastReactivationAt: string | null
}

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: PROJECT_STATUSES })
  @Type(() => String)
  @IsIn(PROJECT_STATUSES)
  projectStatus!: ProjectStatus
}
