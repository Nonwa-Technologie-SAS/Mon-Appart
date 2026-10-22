import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import {
  MediaStatus,
  MediaType,
  MediaVariantKind,
  MediaVisibility,
} from "../../../../generated/prisma/enums"

export class MediaVariantDto {
  @ApiProperty({ enum: Object.values(MediaVariantKind) })
  kind: MediaVariantKind

  @ApiProperty({
    description:
      "URL CDN permanente (bucket public) ou URL présignée courte (média privé, pas de bucket public)",
  })
  url: string

  @ApiProperty({ type: Number, nullable: true })
  width: number | null

  @ApiProperty({ type: Number, nullable: true })
  height: number | null
}

export class MediaResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({
    type: String,
    format: "uuid",
    nullable: true,
    description: "Nul pour un justificatif de vérification",
  })
  propertyId: string | null

  @ApiProperty({ enum: Object.values(MediaType) })
  type: MediaType

  @ApiProperty({ enum: Object.values(MediaStatus) })
  status: MediaStatus

  @ApiProperty({ enum: Object.values(MediaVisibility) })
  visibility: MediaVisibility

  @ApiProperty({ example: "image/jpeg" })
  mimeType: string

  @ApiProperty({ example: 2_450_000 })
  fileSize: number

  @ApiProperty({ type: Number, nullable: true })
  width: number | null

  @ApiProperty({ type: Number, nullable: true })
  height: number | null

  @ApiProperty({ type: Number, nullable: true })
  durationMs: number | null

  @ApiProperty()
  sortOrder: number

  @ApiProperty({ description: "Première photo publique prête dans l'ordre" })
  isPrimary: boolean

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Couverture (variante CARD) ou lecture vidéo ; nulle pour un document",
  })
  url: string | null

  @ApiProperty({ type: [MediaVariantDto] })
  variants: MediaVariantDto[]

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: String, nullable: true })
  readyAt: string | null

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Vue gestionnaire",
  })
  originalFilename?: string | null

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Vue gestionnaire : code du dernier échec de traitement",
  })
  errorCode?: string | null
}

export class MediaListResponseDto {
  @ApiProperty({ type: [MediaResponseDto] })
  items: MediaResponseDto[]
}

export class UploadTargetDto {
  @ApiProperty({ description: "URL d'envoi direct, limitée dans le temps" })
  url: string

  @ApiProperty({ enum: ["PUT"] })
  method: "PUT"

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "string" },
    description: "En-têtes à envoyer tels quels (signés)",
    example: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
  })
  headers: Record<string, string>

  @ApiProperty({ description: "Taille exacte attendue, en octets" })
  contentLength: number

  @ApiProperty()
  expiresAt: string
}

export class UploadSessionResponseDto {
  @ApiProperty({ format: "uuid" })
  sessionId: string

  @ApiProperty({ format: "uuid", description: "Identifiant du média créé" })
  mediaId: string

  @ApiProperty({
    type: String,
    format: "uuid",
    nullable: true,
    description: "Nul pour un justificatif de vérification",
  })
  propertyId: string | null

  @ApiProperty({ enum: Object.values(MediaType) })
  type: MediaType

  @ApiProperty({
    enum: Object.values(MediaStatus),
    description:
      "PENDING_UPLOAD → UPLOADED → PROCESSING → READY ; REJECTED ou FAILED en cas d'échec",
  })
  status: MediaStatus

  @ApiProperty({ type: String, nullable: true })
  expiresAt: string | null

  @ApiProperty({ type: String, nullable: true })
  errorCode: string | null

  @ApiPropertyOptional({
    type: UploadTargetDto,
    description: "Uniquement à la création de la session",
  })
  upload?: UploadTargetDto

  @ApiPropertyOptional({ type: MediaResponseDto })
  media?: MediaResponseDto
}

export class DownloadLinkResponseDto {
  @ApiProperty({ description: "URL présignée courte, à ne pas partager" })
  url: string

  @ApiProperty()
  expiresAt: string
}
