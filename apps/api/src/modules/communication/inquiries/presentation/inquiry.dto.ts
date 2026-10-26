import { ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

import {
  InquiryLeadStage,
  InquiryLostReason,
  InquiryStatus,
} from "../../../../generated/prisma/enums"

const STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VISIT_PLANNED",
  "VISIT_DONE",
  "FOLLOW_UP",
  "CONVERTED",
  "LOST",
  "ARCHIVED",
] as const satisfies readonly InquiryLeadStage[]

const STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const satisfies readonly InquiryStatus[]

const LOST = [
  "BUDGET",
  "LOCATION",
  "TIMING",
  "NO_RESPONSE",
  "PROPERTY_UNAVAILABLE",
  "OTHER",
] as const satisfies readonly InquiryLostReason[]

export class InquiryListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  cursor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  listingId?: string

  @ApiPropertyOptional({ enum: STAGES })
  @IsOptional()
  @IsIn(STAGES)
  stage?: InquiryLeadStage

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: InquiryStatus

  @ApiPropertyOptional({ enum: ["me", "unassigned", "all"] })
  @IsOptional()
  @IsIn(["me", "unassigned", "all"])
  assignee?: "me" | "unassigned" | "all"

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number
}

export class UpdateInquiryDto {
  @ApiPropertyOptional({ enum: STAGES })
  @IsOptional()
  @IsIn(STAGES)
  stage?: InquiryLeadStage

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextActionAt?: Date | null

  @ApiPropertyOptional({ description: "Budget déclaré en XOF (entier)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99_999_999_999)
  budgetAmount?: number | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  desiredZone?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desiredMoveAt?: Date | null

  @ApiPropertyOptional({ enum: LOST })
  @IsOptional()
  @IsIn(LOST)
  lostReason?: InquiryLostReason | null

  @ApiPropertyOptional({
    description: "publicId du collaborateur gestionnaire",
  })
  @IsOptional()
  @IsUUID("4")
  assigneePublicId?: string | null
}

export class AddInquiryNoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string
}

const toNull = ({ value }: { value: unknown }) =>
  value === "" || value === "null" ? null : value

export class OptionalUuidDto {
  @Transform(toNull)
  @IsOptional()
  @IsUUID("4")
  id?: string | null
}
