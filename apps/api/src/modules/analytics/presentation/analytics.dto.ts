import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator"

const DAY = /^\d{4}-\d{2}-\d{2}$/

export class AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    example: "2026-09-14",
    description: "Premier jour inclus (UTC). Défaut : 30 jours avant `to`.",
  })
  @IsOptional()
  @Matches(DAY)
  from?: string

  @ApiPropertyOptional({
    example: "2026-10-13",
    description:
      "Dernier jour inclus (UTC). Défaut : aujourd'hui. 366 jours au plus.",
  })
  @IsOptional()
  @Matches(DAY)
  to?: string
}

export class MyListingsStatsQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class UpdateConsentDto {
  @ApiProperty({ description: "Accepter (true) ou refuser/retirer (false)." })
  @IsBoolean()
  granted: boolean

  @ApiProperty({
    example: "2026-10",
    description: "Version de la politique affichée à l'utilisateur.",
  })
  @IsString()
  @MaxLength(20)
  policyVersion: string

  @ApiProperty({ enum: ["web", "mobile", "api"] })
  @IsIn(["web", "mobile", "api"])
  source: "web" | "mobile" | "api"
}

export class ConsentResponseDto {
  @ApiProperty({ enum: ["GRANTED", "DENIED", "UNSET"] })
  status: "GRANTED" | "DENIED" | "UNSET"

  @ApiProperty({ type: String, nullable: true })
  policyVersion: string | null

  @ApiProperty()
  currentPolicyVersion: string

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  updatedAt: string | null
}

class IngestRejectionDto {
  @ApiProperty({ description: "Position dans le lot" })
  index: number

  @ApiProperty({ format: "uuid" })
  eventId: string

  @ApiProperty({
    example: "invalid_properties",
    description:
      "unknown_event, server_only_event, unsupported_version, forbidden_property, properties_too_large, invalid_properties, out_of_window",
  })
  reason: string
}

export class IngestResponseDto {
  @ApiProperty({ description: "Événements nouvellement enregistrés" })
  accepted: number

  @ApiProperty({ description: "Déjà reçus (même `eventId`) : ne pas renvoyer" })
  duplicates: number

  @ApiProperty({
    description:
      "Valides mais non conservés (consentement absent, collecte désactivée, annonce non publiée ou gérée par l'émetteur)",
  })
  ignored: number

  @ApiProperty({
    type: [IngestRejectionDto],
    description: "Refus définitifs : ne pas renvoyer ces événements",
  })
  rejected: IngestRejectionDto[]
}
