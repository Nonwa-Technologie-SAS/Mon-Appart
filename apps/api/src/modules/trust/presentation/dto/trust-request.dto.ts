import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator"

import {
  OwnershipType,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  TrustSignalSeverity,
  TrustSignalStatus,
  VerificationDocumentType,
  VerificationPriority,
  VerificationStatus,
  VerificationType,
} from "../../../../generated/prisma/enums"
import {
  INFORMATION_REASON_CODES,
  REJECTION_REASON_CODES,
  REVOCATION_REASON_CODES,
} from "../../domain/reason-codes"
import { REQUESTABLE_TYPES } from "../../domain/verification-requirements"

class PageQueryDto {
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

// ------------------------------------------------------------ vérifications

export class VerificationDeclarationDto {
  @ApiPropertyOptional({
    maxLength: 500,
    description:
      "Précision libre et facultative. Ne saisissez aucun numéro de pièce, date de naissance ni adresse.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  statement?: string

  @ApiPropertyOptional({
    maxLength: 200,
    description: "Raison sociale (vérification AGENCY uniquement)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  agencyName?: string
}

export class CreateVerificationDto {
  @ApiProperty({
    enum: REQUESTABLE_TYPES,
    description:
      "Téléphone et e-mail se vérifient par code depuis le compte, pas ici.",
  })
  @IsIn([...REQUESTABLE_TYPES])
  type: VerificationType

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Bien concerné (PROPERTY_OWNERSHIP, OWNER_AUTHORIZATION, PROPERTY_DOCUMENT). Vous devez le gérer.",
  })
  @IsOptional()
  @IsUUID("4")
  propertyId?: string

  @ApiPropertyOptional({
    format: "uuid",
    description: "Annonce contrôlée (LISTING_CONSISTENCY)",
  })
  @IsOptional()
  @IsUUID("4")
  listingId?: string

  @ApiPropertyOptional({
    enum: Object.values(OwnershipType),
    description:
      "Rattachement revendiqué : SOLE/JOINT/USUFRUCT (propriété), AGENT/MANAGER (mandat)",
  })
  @IsOptional()
  @IsIn(Object.values(OwnershipType))
  claimedRelation?: OwnershipType

  @ApiPropertyOptional({ type: VerificationDeclarationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VerificationDeclarationDto)
  declaration?: VerificationDeclarationDto
}

export class AddVerificationDocumentDto {
  @ApiProperty({ enum: Object.values(VerificationDocumentType) })
  @IsIn(Object.values(VerificationDocumentType))
  documentType: VerificationDocumentType

  @ApiProperty({
    example: "application/pdf",
    description:
      "PDF, JPEG, PNG ou WebP ; contrôlé contre la signature du fichier",
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

export class SubmitVerificationDto {
  @ApiProperty({
    enum: [true],
    description:
      "Je déclare sur l'honneur que les informations et pièces fournies sont exactes et que je suis habilité à les transmettre.",
  })
  @IsBoolean()
  @Equals(true)
  attestation: true
}

export class ReviewQueueQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(VerificationStatus) })
  @IsOptional()
  @IsIn(Object.values(VerificationStatus))
  status?: VerificationStatus

  @ApiPropertyOptional({ enum: Object.values(VerificationType) })
  @IsOptional()
  @IsIn(Object.values(VerificationType))
  type?: VerificationType

  @ApiPropertyOptional({ enum: Object.values(VerificationPriority) })
  @IsOptional()
  @IsIn(Object.values(VerificationPriority))
  priority?: VerificationPriority

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  assignedToMe?: boolean
}

class InternalNoteDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: "Note réservée aux relecteurs ; jamais montrée au déclarant",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string
}

class UserMessageDto extends InternalNoteDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    description: "Message montré au déclarant (pièce attendue, précision)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string
}

export class AssignVerificationDto extends InternalNoteDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Instructeur désigné ; vous-même par défaut",
  })
  @IsOptional()
  @IsUUID("4")
  assigneeId?: string
}

export class EscalateVerificationDto extends InternalNoteDto {}

export class ApproveVerificationDto extends UserMessageDto {}

export class RequestInformationDto extends UserMessageDto {
  @ApiProperty({ enum: INFORMATION_REASON_CODES })
  @IsIn(INFORMATION_REASON_CODES)
  reasonCode: string
}

export class RejectVerificationDto extends UserMessageDto {
  @ApiProperty({ enum: REJECTION_REASON_CODES })
  @IsIn(REJECTION_REASON_CODES)
  reasonCode: string
}

export class RevokeVerificationDto extends UserMessageDto {
  @ApiProperty({ enum: REVOCATION_REASON_CODES })
  @IsIn(REVOCATION_REASON_CODES)
  reasonCode: string
}

// ------------------------------------------------------------ signalements

export class CreateReportDto {
  @ApiProperty({ enum: Object.values(ReportTargetType) })
  @IsIn(Object.values(ReportTargetType))
  targetType: ReportTargetType

  @ApiPropertyOptional({
    format: "uuid",
    description: "Si targetType = LISTING",
  })
  @IsOptional()
  @IsUUID("4")
  listingId?: string

  @ApiPropertyOptional({ format: "uuid", description: "Si targetType = USER" })
  @IsOptional()
  @IsUUID("4")
  userId?: string

  @ApiPropertyOptional({
    format: "uuid",
    description: "Si targetType = MESSAGE ou CONVERSATION (participants seulement)",
  })
  @IsOptional()
  @IsUUID("4")
  conversationId?: string

  @ApiPropertyOptional({ format: "uuid", description: "Si targetType = MESSAGE" })
  @IsOptional()
  @IsUUID("4")
  messageId?: string

  @ApiProperty({ enum: Object.values(ReportReason) })
  @IsIn(Object.values(ReportReason))
  reason: ReportReason

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string
}

export class ConversationReportDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Message visé ; sinon la conversation entière",
  })
  @IsOptional()
  @IsUUID("4")
  messageId?: string

  @ApiProperty({ enum: Object.values(ReportReason) })
  @IsIn(Object.values(ReportReason))
  reason: ReportReason

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string
}

export class ReportQueueQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(ReportStatus) })
  @IsOptional()
  @IsIn(Object.values(ReportStatus))
  status?: ReportStatus

  @ApiPropertyOptional({ enum: Object.values(ReportTargetType) })
  @IsOptional()
  @IsIn(Object.values(ReportTargetType))
  targetType?: ReportTargetType

  @ApiPropertyOptional({ enum: Object.values(VerificationPriority) })
  @IsOptional()
  @IsIn(Object.values(VerificationPriority))
  priority?: VerificationPriority
}

export class ResolveReportDto extends InternalNoteDto {
  @ApiProperty({ enum: ["CONFIRMED", "DISMISSED"] })
  @IsIn(["CONFIRMED", "DISMISSED"])
  outcome: "CONFIRMED" | "DISMISSED"

  @ApiPropertyOptional({
    enum: Object.values(ReportAction),
    description:
      "Mesure décidée (CONFIRMED seulement). LISTING_SUSPENDED passe par le workflow des annonces ; VERIFICATION_REVIEW_REQUESTED ouvre une alerte, sans révocation automatique.",
  })
  @IsOptional()
  @IsIn(Object.values(ReportAction))
  action?: ReportAction
}

// ------------------------------------------------------------ alertes

export class SignalQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(TrustSignalStatus) })
  @IsOptional()
  @IsIn(Object.values(TrustSignalStatus))
  status?: TrustSignalStatus

  @ApiPropertyOptional({ enum: Object.values(TrustSignalSeverity) })
  @IsOptional()
  @IsIn(Object.values(TrustSignalSeverity))
  severity?: TrustSignalSeverity
}

export class ReviewSignalDto {
  @ApiProperty({ enum: ["CONFIRMED", "DISMISSED"] })
  @IsIn(["CONFIRMED", "DISMISSED"])
  outcome: "CONFIRMED" | "DISMISSED"

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string
}
