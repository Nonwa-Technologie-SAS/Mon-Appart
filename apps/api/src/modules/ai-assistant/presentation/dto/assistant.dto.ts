import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator"

export class CreateConversationResponseDto {
  @ApiProperty()
  conversationId!: string
}

export class AssistantMessageDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string

  @ApiPropertyOptional({
    description: "Ignorer les clarifications et lancer Search immédiatement",
  })
  @IsOptional()
  @IsBoolean()
  forceSearch?: boolean

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID("4", { each: true })
  compareListingIds?: string[]
}

export class CompareListingsDto {
  @ApiProperty({ type: [String], minItems: 2, maxItems: 4 })
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID("4", { each: true })
  listingIds!: string[]
}

export class AssistantFeedbackDto {
  @ApiProperty({ enum: ["helpful", "not_helpful", "wrong_results"] })
  @IsIn(["helpful", "not_helpful", "wrong_results"])
  rating!: "helpful" | "not_helpful" | "wrong_results"

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}

export class NaturalSearchDto {
  @ApiProperty({
    example: "Maison 3 chambres à louer à Cocody, budget 250 000 FCFA par mois",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceSearch?: boolean
}
