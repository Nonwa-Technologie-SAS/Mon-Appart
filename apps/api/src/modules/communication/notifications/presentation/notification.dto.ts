import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator"

import {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  PushPlatform,
} from "../../../../generated/prisma/enums"

export class NotificationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  unreadOnly?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class NotificationResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(NotificationType) })
  type: NotificationType

  @ApiProperty({ enum: Object.values(NotificationCategory) })
  category: NotificationCategory

  @ApiProperty()
  title: string

  @ApiProperty({ type: String, nullable: true })
  body: string | null

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "Identifiants publics liés (ex. conversationId)",
  })
  data: Record<string, unknown>

  @ApiProperty({ type: String, nullable: true })
  readAt: string | null

  @ApiProperty()
  createdAt: string
}

export class NotificationPageResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items: NotificationResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null

  @ApiProperty({ description: "Notifications non lues (total)" })
  unread: number
}

export class UnreadCountResponseDto {
  @ApiProperty()
  unread: number
}

export class MarkAllReadResponseDto {
  @ApiProperty()
  updated: number
}

export class PreferenceCellDto {
  @ApiProperty({ enum: Object.values(NotificationCategory) })
  category: NotificationCategory

  @ApiProperty({ enum: Object.values(NotificationChannel) })
  channel: NotificationChannel

  @ApiProperty()
  enabled: boolean

  @ApiProperty({ description: "Indispensable au service : non désactivable" })
  locked: boolean

  @ApiProperty({ description: "Canal configuré sur cette instance" })
  available: boolean
}

export class PreferencesResponseDto {
  @ApiProperty({ type: [PreferenceCellDto] })
  items: PreferenceCellDto[]
}

export class PreferenceChangeDto {
  @ApiProperty({ enum: Object.values(NotificationCategory) })
  @IsIn(Object.values(NotificationCategory))
  category: NotificationCategory

  @ApiProperty({ enum: Object.values(NotificationChannel) })
  @IsIn(Object.values(NotificationChannel))
  channel: NotificationChannel

  @ApiProperty()
  @IsBoolean()
  enabled: boolean
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: [PreferenceChangeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => PreferenceChangeDto)
  items: PreferenceChangeDto[]
}

export class RegisterPushDeviceDto {
  @ApiProperty({ description: "Jeton FCM/APNs ; jamais renvoyé ni journalisé" })
  @IsString()
  @MinLength(16)
  @MaxLength(4096)
  @Matches(/^[\x21-\x7e]+$/, { message: "token invalide" })
  token: string

  @ApiProperty({ enum: Object.values(PushPlatform) })
  @IsIn(Object.values(PushPlatform))
  platform: PushPlatform
}

export class PushDeviceResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(PushPlatform) })
  platform: PushPlatform

  @ApiProperty()
  lastSeenAt: string

  @ApiProperty()
  createdAt: string
}

export class PushDeviceListResponseDto {
  @ApiProperty({ type: [PushDeviceResponseDto] })
  items: PushDeviceResponseDto[]
}
