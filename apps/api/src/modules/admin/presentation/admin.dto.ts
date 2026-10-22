import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { ROLES, type Role } from "@mon-appart/types"
import { Transform, Type } from "class-transformer"
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

import {
  ListingStatus,
  ListingType,
  ModerationAction,
  UserStatus,
} from "../../../generated/prisma/enums"

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === "true"
    ? true
    : value === false || value === "false"
      ? false
      : value

class CursorPageDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4")
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

// ------------------------------------------------------------ utilisateurs

export class UserSearchQueryDto extends CursorPageDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      "Identifiant public exact, nom partiel (2 caractères au moins), ou e-mail / téléphone exacts (permission `user:pii`).",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string

  @ApiPropertyOptional({ enum: Object.values(UserStatus) })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn([...ROLES])
  role?: Role
}

export class ReasonDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 500,
    description: "Motif interne, conservé dans le journal d'audit.",
  })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string
}

export class AccountDecisionDto extends ReasonDto {
  @ApiProperty({
    enum: Object.values(UserStatus),
    description: "Statut affiché lors de la décision : 409 s'il a changé.",
  })
  @IsIn(Object.values(UserStatus))
  expectedStatus: UserStatus
}

export class ChangeRoleDto extends ReasonDto {
  @ApiProperty({ enum: ROLES })
  @IsIn([...ROLES])
  role: Role

  @ApiProperty({ enum: ["grant", "revoke"] })
  @IsIn(["grant", "revoke"])
  operation: "grant" | "revoke"
}

export class AddNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string
}

// ------------------------------------------------------------ annonces

export class ListingQueueQueryDto extends CursorPageDto {
  @ApiPropertyOptional({
    enum: Object.values(ListingStatus),
    default: "PENDING_REVIEW",
  })
  @IsOptional()
  @IsIn(Object.values(ListingStatus))
  status?: ListingStatus

  @ApiPropertyOptional({ enum: Object.values(ListingType) })
  @IsOptional()
  @IsIn(Object.values(ListingType))
  listingType?: ListingType

  @ApiPropertyOptional({
    maxLength: 100,
    description: "Identifiant public exact ou titre partiel",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string
}

export class ModerateListingDto {
  @ApiProperty({
    enum: Object.values(ListingStatus),
    description: "Statut affiché lors de la décision : 409 s'il a changé.",
  })
  @IsIn(Object.values(ListingStatus))
  expectedStatus: ListingStatus

  @ApiPropertyOptional({
    description:
      "Code d'un motif actif (`GET /admin/moderation-reasons`) : obligatoire pour refuser, demander des corrections ou suspendre.",
  })
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/)
  reasonCode?: string

  @ApiPropertyOptional({
    maxLength: 500,
    description:
      "Précision envoyée au propriétaire, en plus du message du motif. Visible de lui.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  ownerMessage?: string

  @ApiPropertyOptional({
    maxLength: 2000,
    description:
      "Commentaire interne, jamais transmis au propriétaire. Obligatoire pour restaurer.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  internalNote?: string
}

// ------------------------------------------------------------ motifs

export class ModerationReasonQueryDto {
  @ApiPropertyOptional({ enum: Object.values(ModerationAction) })
  @IsOptional()
  @IsIn(Object.values(ModerationAction))
  action?: ModerationAction

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean
}

export class UpdateModerationReasonDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 500,
    description:
      "Message envoyé au propriétaire : aucun détail interne ni antifraude.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ownerMessage?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number
}

export class CreateModerationReasonDto {
  @ApiProperty({ pattern: "^[A-Z][A-Z0-9_]{1,63}$" })
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/)
  code: string

  @ApiProperty({ enum: Object.values(ModerationAction) })
  @IsIn(Object.values(ModerationAction))
  action: ModerationAction

  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label: string

  @ApiProperty({
    minLength: 1,
    maxLength: 500,
    description:
      "Message envoyé au propriétaire : aucun détail interne ni antifraude.",
  })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ownerMessage: string

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number
}

// ------------------------------------------------------------ audit

export class AuditQueryDto {
  @ApiPropertyOptional({ example: "listing" })
  @IsOptional()
  @Matches(/^[a-z][a-z_]{0,49}$/)
  entityType?: string

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string

  @ApiPropertyOptional({ example: "LISTING_MODERATED" })
  @IsOptional()
  @Matches(/^[A-Z][A-Z_]{0,99}$/)
  action?: string

  @ApiPropertyOptional({ format: "uuid", description: "Auteur de l'action" })
  @IsOptional()
  @IsUUID("4")
  actorId?: string

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date

  @ApiPropertyOptional({ description: "Curseur opaque de la page précédente" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
