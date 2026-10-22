import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Equals,
  Max,
  MaxLength,
  Min,
} from "class-validator"

import { MediaType, MediaVisibility } from "../../../../generated/prisma/enums"

export class CreateUploadSessionDto {
  @ApiProperty({
    format: "uuid",
    description: "Bien auquel rattacher le média",
  })
  @IsUUID("4")
  propertyId: string

  @ApiProperty({ enum: Object.values(MediaType) })
  @IsIn(Object.values(MediaType))
  type: MediaType

  @ApiProperty({
    example: "image/jpeg",
    description:
      "Type annoncé, contrôlé contre la liste autorisée puis contre la signature du fichier reçu",
  })
  @IsString()
  @MaxLength(127)
  mimeType: string

  @ApiProperty({
    example: 2_450_000,
    description:
      "Taille exacte en octets ; l'URL d'envoi n'accepte que cette taille",
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  size: number

  @ApiPropertyOptional({
    example: "salon.jpg",
    description: "Nom d'origine, informatif (jamais utilisé comme chemin)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string

  @ApiPropertyOptional({
    enum: Object.values(MediaVisibility),
    description: "PUBLIC par défaut ; un document est toujours PRIVATE",
  })
  @IsOptional()
  @IsIn(Object.values(MediaVisibility))
  visibility?: MediaVisibility
}

export class ReorderMediaDto {
  @ApiProperty({
    type: [String],
    format: "uuid",
    description: "Tous les médias actuels du bien, dans le nouvel ordre",
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID("4", { each: true })
  mediaIds: string[]
}

export class UpdateMediaDto {
  @ApiProperty({
    enum: [true],
    description: "Définit ce média comme image principale du bien",
  })
  @IsBoolean()
  @Equals(true)
  isPrimary: true
}
