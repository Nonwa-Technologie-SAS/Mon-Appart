import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator"

export class FavoriteListingParamDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  listingId!: string
}

export class RecordViewDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  listingId!: string

  @ApiPropertyOptional({
    enum: [
      "SEARCH",
      "RECOMMENDATION",
      "DIRECT",
      "FAVORITE",
      "NOTIFICATION",
      "SHARE",
    ],
    default: "DIRECT",
  })
  @IsOptional()
  @IsString()
  source?: string

  @ApiPropertyOptional({
    description: "Durée de consultation en ms (0..3600000)",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  durationMs?: number

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string
}
