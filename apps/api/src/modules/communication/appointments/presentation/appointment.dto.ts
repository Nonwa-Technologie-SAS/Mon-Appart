import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator"

import { AppointmentStatus } from "../../../../generated/prisma/enums"
import { PersonResponseDto } from "../../messaging/presentation/messaging.dto"
import {
  APPOINTMENT_ACTIONS,
  CANCELLATION_REASONS,
  type CancellationReason,
} from "../domain/appointment-rules"

export class RequestVisitDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  listingId: string

  @ApiProperty({
    format: "date-time",
    description: "Instant ISO 8601 avec décalage (stocké en UTC)",
  })
  @Type(() => Date)
  @IsDate()
  scheduledAt: Date

  @ApiPropertyOptional({
    example: "Africa/Abidjan",
    description: "Fuseau IANA",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string

  @ApiPropertyOptional({ minimum: 15, maximum: 480, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number

  @ApiPropertyOptional({
    maxLength: 1000,
    description: "Visible des deux parties ; pas de document ni de coordonnées",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string
}

export class RescheduleVisitDto {
  @ApiProperty({ format: "date-time" })
  @Type(() => Date)
  @IsDate()
  scheduledAt: Date
}

export class CancelVisitDto {
  @ApiPropertyOptional({ enum: CANCELLATION_REASONS, default: "OTHER" })
  @IsOptional()
  @IsIn(CANCELLATION_REASONS)
  reason?: CancellationReason
}

export class AppointmentQueryDto {
  @ApiPropertyOptional({
    enum: ["upcoming", "past", "all"],
    default: "upcoming",
  })
  @IsOptional()
  @IsIn(["upcoming", "past", "all"])
  scope?: "upcoming" | "past" | "all"

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class AppointmentListingDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  title: string
}

export class AppointmentResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(AppointmentStatus) })
  status: AppointmentStatus

  @ApiProperty({ enum: ["REQUESTER", "LISTING_SIDE"] })
  side: string

  @ApiProperty()
  scheduledAt: string

  @ApiProperty()
  timezone: string

  @ApiProperty()
  durationMinutes: number

  @ApiProperty({ type: String, nullable: true })
  notes: string | null

  @ApiProperty({ type: String, nullable: true })
  proposedAt: string | null

  @ApiProperty({ enum: ["REQUESTER", "LISTING_SIDE"], nullable: true })
  proposedBy: string | null

  @ApiProperty({ type: AppointmentListingDto })
  listing: AppointmentListingDto

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  conversationId: string | null

  @ApiProperty({ type: PersonResponseDto })
  requester: PersonResponseDto

  @ApiProperty({ type: String, nullable: true })
  confirmedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  cancelledAt: string | null

  @ApiProperty({ enum: ["REQUESTER", "LISTING_SIDE"], nullable: true })
  cancelledBy: string | null

  @ApiProperty({ type: String, nullable: true })
  cancellationReason: string | null

  @ApiProperty({ type: String, nullable: true })
  completedAt: string | null

  @ApiProperty()
  createdAt: string

  @ApiProperty({ enum: APPOINTMENT_ACTIONS, isArray: true })
  actions: string[]

  @ApiProperty({
    type: "object",
    additionalProperties: false,
    properties: {
      submitted: { type: "boolean" },
      outcome: { type: "string", nullable: true },
    },
    description:
      "Retour post-visite. L'issue n'est visible côté annonce que si le prospect l'a partagée.",
  })
  feedback: { submitted: boolean; outcome: string | null }
}

export class SubmitVisitFeedbackDto {
  @ApiProperty({
    enum: [
      "PENDING_DECISION",
      "STILL_INTERESTED",
      "NEED_INFO",
      "WANT_ANOTHER_VISIT",
      "NOT_A_FIT",
      "UNAVAILABLE",
      "PROJECT_ABANDONED",
      "PROJECT_COMPLETED",
    ],
  })
  @IsIn([
    "PENDING_DECISION",
    "STILL_INTERESTED",
    "NEED_INFO",
    "WANT_ANOTHER_VISIT",
    "NOT_A_FIT",
    "UNAVAILABLE",
    "PROJECT_ABANDONED",
    "PROJECT_COMPLETED",
  ])
  outcome!: string

  @ApiPropertyOptional({
    enum: ["PRICE", "LOCATION", "SURFACE", "FEATURES", "UNAVAILABLE", "OTHER"],
  })
  @IsOptional()
  @IsIn(["PRICE", "LOCATION", "SURFACE", "FEATURES", "UNAVAILABLE", "OTHER"])
  reason?: string

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  privateNote?: string

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  shareOutcomeWithOwner?: boolean
}

export class AppointmentListResponseDto {
  @ApiProperty({ type: [AppointmentResponseDto] })
  items: AppointmentResponseDto[]
}
