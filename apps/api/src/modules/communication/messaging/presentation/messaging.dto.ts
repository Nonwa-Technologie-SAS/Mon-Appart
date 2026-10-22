import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ConversationStatus,
  ConversationType,
  ListingStatus,
  ListingType,
  MessageType,
} from "../../../../generated/prisma/enums"
import { MAX_BODY_LENGTH } from "../domain/message-rules"

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === "true"

export class StartConversationDto {
  @ApiProperty({ format: "uuid", description: "Annonce publiée à contacter" })
  @IsUUID("4")
  listingId: string

  @ApiProperty({ maxLength: MAX_BODY_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY_LENGTH)
  message: string

  @ApiPropertyOptional({
    format: "uuid",
    description: "Clé d'idempotence : un renvoi ne duplique pas le message",
  })
  @IsOptional()
  @IsUUID("4")
  clientMessageId?: string
}

export class ConversationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  archived?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class MessageQueryDto {
  @ApiPropertyOptional({
    description: "Messages de numéro inférieur (historique)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before?: number

  @ApiPropertyOptional({
    description: "Messages de numéro supérieur (rattrapage après reconnexion)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class SendMessageDto {
  @ApiPropertyOptional({ maxLength: MAX_BODY_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BODY_LENGTH)
  body?: string

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description:
      "Médias envoyés via POST /conversations/:id/attachments puis terminés",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  attachmentIds?: string[]

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4")
  clientMessageId?: string
}

export class MarkReadDto {
  @ApiPropertyOptional({
    description: "Dernier numéro lu ; par défaut, toute la conversation",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  upToSeq?: number
}

export class ArchiveConversationDto {
  @ApiProperty()
  @IsBoolean()
  archived: boolean
}

export class MuteConversationDto {
  @ApiProperty({
    description: "Sans e-mail, SMS ni push pour cette conversation",
  })
  @IsBoolean()
  muted: boolean
}

export class AttachmentUploadDto {
  @ApiProperty({ enum: ["IMAGE", "DOCUMENT"] })
  @IsIn(["IMAGE", "DOCUMENT"])
  type: "IMAGE" | "DOCUMENT"

  @ApiProperty({
    example: "image/jpeg",
    description: "Contrôlé contre la signature du fichier",
  })
  @IsString()
  @MaxLength(127)
  mimeType: string

  @ApiProperty({ example: 380_000, description: "Taille exacte en octets" })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  size: number

  @ApiPropertyOptional({
    description: "Nom d'origine, informatif (jamais utilisé comme chemin)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string
}

export class PersonResponseDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  id: string | null

  @ApiProperty({ enum: ["REQUESTER", "LISTING_SIDE", "SYSTEM"] })
  role: string

  @ApiProperty({ description: "Prénom et initiale ; jamais de coordonnées" })
  displayName: string
}

export class AttachmentResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: ["IMAGE", "DOCUMENT"] })
  type: string

  @ApiProperty()
  mimeType: string

  @ApiProperty()
  size: number

  @ApiProperty({ type: String, nullable: true })
  filename: string | null

  @ApiProperty({ type: Number, nullable: true })
  width: number | null

  @ApiProperty({ type: Number, nullable: true })
  height: number | null

  @ApiProperty()
  ready: boolean
}

export class MessageResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ format: "uuid" })
  conversationId: string

  @ApiProperty({
    description: "Numéro croissant sans trou dans la conversation",
  })
  seq: number

  @ApiProperty({ enum: Object.values(MessageType) })
  type: MessageType

  @ApiProperty({ type: String, nullable: true })
  body: string | null

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Messages SYSTEM : code rendu par le client",
  })
  systemCode: string | null

  @ApiProperty({ type: "object", additionalProperties: true })
  data: Record<string, unknown>

  @ApiProperty({ type: PersonResponseDto, nullable: true })
  author: PersonResponseDto | null

  @ApiProperty()
  mine: boolean

  @ApiProperty({
    enum: ["SENT", "DELIVERED", "READ"],
    nullable: true,
    description: "Pour mes messages uniquement",
  })
  status: string | null

  @ApiProperty({ type: [AttachmentResponseDto] })
  attachments: AttachmentResponseDto[]

  @ApiProperty()
  deleted: boolean

  @ApiProperty()
  createdAt: string
}

export class MessagePageResponseDto {
  @ApiProperty({
    type: [MessageResponseDto],
    description: "Ordre chronologique",
  })
  items: MessageResponseDto[]

  @ApiProperty()
  hasMore: boolean

  @ApiProperty()
  lastReadSeq: number

  @ApiProperty()
  lastSeq: number
}

export class SendMessageResponseDto {
  @ApiProperty({ type: MessageResponseDto })
  message: MessageResponseDto

  @ApiProperty({ description: "Renvoi d'un message déjà enregistré" })
  duplicate: boolean
}

export class ConversationListingDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  title: string

  @ApiProperty({ enum: Object.values(ListingType) })
  listingType: ListingType

  @ApiProperty({ enum: Object.values(ListingStatus) })
  status: ListingStatus
}

export class ConversationResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(ConversationType) })
  type: ConversationType

  @ApiProperty({ enum: Object.values(ConversationStatus) })
  status: ConversationStatus

  @ApiProperty({ enum: ["REQUESTER", "LISTING_SIDE"] })
  side: string

  @ApiProperty({ type: ConversationListingDto })
  listing: ConversationListingDto

  @ApiProperty({ type: [PersonResponseDto] })
  participants: PersonResponseDto[]

  @ApiProperty({ type: MessageResponseDto, nullable: true })
  lastMessage: MessageResponseDto | null

  @ApiProperty()
  unread: number

  @ApiProperty()
  lastReadSeq: number

  @ApiProperty()
  lastSeq: number

  @ApiProperty()
  archived: boolean

  @ApiProperty()
  muted: boolean

  @ApiProperty()
  lastActivityAt: string

  @ApiProperty({ type: String, nullable: true })
  closedAt: string | null

  @ApiProperty()
  createdAt: string
}

export class ConversationPageResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  items: ConversationResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

export class StartConversationResponseDto {
  @ApiProperty({ type: ConversationResponseDto })
  conversation: ConversationResponseDto

  @ApiProperty({ type: MessageResponseDto })
  message: MessageResponseDto

  @ApiProperty({ description: "false : conversation existante reprise" })
  created: boolean
}

export class MarkReadResponseDto {
  @ApiProperty()
  lastReadSeq: number

  @ApiProperty()
  unread: number
}

export class ConversationUnreadResponseDto {
  @ApiProperty({ description: "Messages non lus, toutes conversations" })
  unread: number
}
