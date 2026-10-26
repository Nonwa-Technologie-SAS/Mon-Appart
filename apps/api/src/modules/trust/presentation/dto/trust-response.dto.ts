import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import {
  MediaStatus,
  OwnershipType,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  TrustActorKind,
  TrustSignalSeverity,
  TrustSignalStatus,
  VerificationDocumentStatus,
  VerificationDocumentType,
  VerificationPriority,
  VerificationStatus,
  VerificationType,
} from "../../../../generated/prisma/enums"
import { UploadSessionResponseDto } from "../../../media"
import { BadgeCode } from "../../domain/badges"

export class ReasonDto {
  @ApiProperty()
  code: string

  @ApiProperty({ description: "Message public neutre associé au motif" })
  message: string
}

export class VerificationDocumentDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(VerificationDocumentType) })
  documentType: VerificationDocumentType

  @ApiProperty({ enum: Object.values(VerificationDocumentStatus) })
  status: VerificationDocumentStatus

  @ApiProperty({
    format: "uuid",
    description: "Session d'envoi Media (suivi, confirmation)",
  })
  uploadId: string

  @ApiProperty({ enum: Object.values(MediaStatus) })
  uploadStatus: MediaStatus

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: String, nullable: true })
  reviewedAt: string | null
}

export class RequirementDto {
  @ApiProperty({ enum: Object.values(VerificationDocumentType), isArray: true })
  accepted: VerificationDocumentType[]

  @ApiProperty({
    type: "array",
    items: { type: "array", items: { type: "string" } },
    description: "Groupes obligatoires : une pièce de chaque groupe",
  })
  required: VerificationDocumentType[][]

  @ApiProperty({
    type: "array",
    items: { type: "array", items: { type: "string" } },
    description: "Groupes encore non couverts par une pièce prête",
  })
  missing: VerificationDocumentType[][]
}

export class HistoryEntryDto {
  @ApiProperty()
  action: string

  @ApiProperty({ enum: Object.values(VerificationStatus) })
  status: VerificationStatus

  @ApiProperty({ type: ReasonDto, nullable: true })
  reason: ReasonDto | null

  @ApiProperty({ type: String, nullable: true })
  message: string | null

  @ApiProperty()
  at: string
}

class VerificationCoreDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(VerificationType) })
  type: VerificationType

  @ApiProperty({ enum: Object.values(VerificationStatus) })
  status: VerificationStatus

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  propertyId: string | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  listingId: string | null

  @ApiProperty({ enum: Object.values(OwnershipType), nullable: true })
  claimedRelation: OwnershipType | null

  @ApiProperty({ type: ReasonDto, nullable: true })
  reason: ReasonDto | null

  @ApiProperty({ type: "object", additionalProperties: true })
  declaration: Record<string, unknown>

  @ApiProperty({ type: String, nullable: true })
  attestedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  submittedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  decidedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  verifiedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  expiresAt: string | null

  @ApiProperty()
  createdAt: string

  @ApiProperty()
  updatedAt: string

  @ApiProperty({ type: RequirementDto, nullable: true })
  requirements: RequirementDto | null
}

export class VerificationResponseDto extends VerificationCoreDto {
  @ApiProperty({ type: [VerificationDocumentDto] })
  documents: VerificationDocumentDto[]

  @ApiProperty({ type: [HistoryEntryDto] })
  history: HistoryEntryDto[]
}

export class VerificationListResponseDto {
  @ApiProperty({ type: [VerificationResponseDto] })
  items: VerificationResponseDto[]
}

export class DocumentUploadResponseDto {
  @ApiProperty({ format: "uuid" })
  documentId: string

  @ApiProperty({
    type: UploadSessionResponseDto,
    description:
      "Envoyez le fichier à `upload.url`, puis confirmez via POST /media/upload-sessions/{sessionId}/complete",
  })
  upload: UploadSessionResponseDto
}

// ------------------------------------------------------------ relecture

export class ReviewDocumentDto extends VerificationDocumentDto {
  @ApiProperty()
  mimeType: string

  @ApiProperty()
  fileSize: number

  @ApiProperty({
    type: String,
    nullable: true,
    description: "NOT_SCANNED : aucun antivirus branché, rien n'est affirmé",
  })
  scan: string | null
}

export class ReviewHistoryEntryDto extends HistoryEntryDto {
  @ApiProperty({ enum: Object.values(TrustActorKind) })
  actorKind: TrustActorKind

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  actorId: string | null

  @ApiProperty({ type: String, nullable: true })
  internalNote: string | null
}

export class ReviewSignalSummaryDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  ruleCode: string

  @ApiProperty({ enum: Object.values(TrustSignalSeverity) })
  severity: string

  @ApiProperty({ enum: Object.values(TrustSignalStatus) })
  status: string

  @ApiProperty()
  createdAt: string
}

export class ReviewSubjectDto {
  @ApiProperty({ format: "uuid" })
  userId: string

  @ApiProperty({ type: String, nullable: true })
  firstName: string | null

  @ApiProperty({ type: String, nullable: true })
  lastName: string | null

  @ApiProperty()
  phoneVerified: boolean

  @ApiProperty()
  emailVerified: boolean
}

export class ReviewTargetDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  title: string
}

export class ReviewVerificationResponseDto extends VerificationCoreDto {
  @ApiProperty({ enum: Object.values(VerificationPriority) })
  priority: VerificationPriority

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  assignedTo: string | null

  @ApiProperty({ type: ReviewSubjectDto })
  subject: ReviewSubjectDto

  @ApiProperty({ type: ReviewTargetDto, nullable: true })
  property: ReviewTargetDto | null

  @ApiProperty({ type: ReviewTargetDto, nullable: true })
  listing: ReviewTargetDto | null

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description:
      "Précontrôles automatiques : aide à l'instruction, jamais une preuve",
  })
  prechecks: Record<string, unknown>

  @ApiProperty({ type: [ReviewDocumentDto] })
  documents: ReviewDocumentDto[]

  @ApiProperty({ type: [ReviewHistoryEntryDto] })
  history: ReviewHistoryEntryDto[]

  @ApiProperty({ type: [ReviewSignalSummaryDto] })
  signals: ReviewSignalSummaryDto[]
}

export class ReviewQueueItemDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(VerificationType) })
  type: VerificationType

  @ApiProperty({ enum: Object.values(VerificationStatus) })
  status: VerificationStatus

  @ApiProperty({ enum: Object.values(VerificationPriority) })
  priority: VerificationPriority

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  assignedTo: string | null

  @ApiProperty({ format: "uuid" })
  subjectId: string

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  propertyId: string | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  listingId: string | null

  @ApiProperty()
  documents: number

  @ApiProperty({ type: String, nullable: true })
  submittedAt: string | null

  @ApiProperty()
  createdAt: string
}

export class ReviewQueueResponseDto {
  @ApiProperty({ type: [ReviewQueueItemDto] })
  items: ReviewQueueItemDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

// ------------------------------------------------------------ signalements

export class OwnReportResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(ReportTargetType) })
  targetType: ReportTargetType

  @ApiProperty({ format: "uuid" })
  targetId: string

  @ApiProperty({ enum: Object.values(ReportReason) })
  reason: ReportReason

  @ApiProperty({
    enum: ["OPEN", "IN_REVIEW", "RESOLVED"],
    description: "L'issue détaillée de l'examen n'est pas communiquée",
  })
  status: "OPEN" | "IN_REVIEW" | "RESOLVED"

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: String, nullable: true })
  resolvedAt: string | null
}

export class OwnReportListResponseDto {
  @ApiProperty({ type: [OwnReportResponseDto] })
  items: OwnReportResponseDto[]
}

export class ConversationExcerptMessageDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  seq: number

  @ApiProperty()
  type: string

  @ApiProperty({ type: String, nullable: true })
  body: string | null

  @ApiProperty({ type: String, nullable: true })
  systemCode: string | null

  @ApiProperty({ enum: ["REQUESTER", "LISTING_SIDE", "SYSTEM"] })
  authorRole: string

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  authorId: string | null

  @ApiProperty({ description: "Nombre de pièces jointes (non exposées ici)" })
  attachments: number

  @ApiProperty()
  reported: boolean

  @ApiProperty()
  createdAt: string
}

export class ReportHistoryEntryDto {
  @ApiProperty()
  action: string

  @ApiProperty({ enum: Object.values(ReportStatus) })
  status: ReportStatus

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  actorId: string | null

  @ApiProperty({ type: String, nullable: true })
  internalNote: string | null

  @ApiProperty()
  at: string
}

export class ReviewReportResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(ReportTargetType) })
  targetType: ReportTargetType

  @ApiProperty({ format: "uuid" })
  targetId: string

  @ApiProperty({ enum: Object.values(ReportReason) })
  reason: ReportReason

  @ApiProperty({ type: String, nullable: true })
  description: string | null

  @ApiProperty({ enum: Object.values(ReportStatus) })
  status: ReportStatus

  @ApiProperty({ enum: Object.values(VerificationPriority) })
  priority: VerificationPriority

  @ApiProperty({ enum: Object.values(ReportAction), nullable: true })
  action: ReportAction | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  reporterId: string | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  assignedTo: string | null

  @ApiProperty({
    description: "Déclarants distincts avec un signalement ouvert sur la cible",
  })
  openReportsOnTarget: number

  @ApiPropertyOptional({
    type: [ConversationExcerptMessageDto],
    description:
      "Détail d'un signalement de message/conversation : le message visé, ou les 20 derniers messages ; jamais la conversation entière",
  })
  conversationExcerpt?: ConversationExcerptMessageDto[]

  @ApiPropertyOptional({
    description:
      "Alertes ouvertes liées à l'annonce. Un code n'est pas une preuve de fraude.",
  })
  relatedSignals?: Array<{
    id: string
    ruleCode: string
    severity: string
    status: string
  }>

  @ApiPropertyOptional({
    description:
      "Évaluation listing-risk-v1 : recommandation d'examen, distincte du statut public et de la décision.",
  })
  listingRisk?: {
    version: string
    level: string
    recommendedAction: string
    humanReviewRequired: boolean
    signals: Array<{ rule: string; severity: string }>
  }

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: String, nullable: true })
  resolvedAt: string | null

  @ApiProperty({ type: [ReportHistoryEntryDto] })
  history: ReportHistoryEntryDto[]
}

export class ReportQueueResponseDto {
  @ApiProperty({ type: [ReviewReportResponseDto] })
  items: ReviewReportResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

// ------------------------------------------------------------ alertes, score

export class SignalResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  ruleCode: string

  @ApiProperty({ enum: Object.values(TrustSignalSeverity) })
  severity: TrustSignalSeverity

  @ApiProperty({ enum: Object.values(TrustSignalStatus) })
  status: TrustSignalStatus

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  userId: string | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  listingId: string | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  verificationId: string | null

  @ApiProperty({ type: "object", additionalProperties: true })
  details: Record<string, unknown>

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  reviewedBy: string | null

  @ApiProperty({ type: String, nullable: true })
  reviewedAt: string | null

  @ApiProperty({ type: String, nullable: true })
  reviewNote: string | null

  @ApiProperty()
  createdAt: string
}

export class SignalPageResponseDto {
  @ApiProperty({ type: [SignalResponseDto] })
  items: SignalResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}

export class ScoreFactorDto {
  @ApiProperty()
  code: string

  @ApiProperty({ oneOf: [{ type: "boolean" }, { type: "number" }] })
  observed: boolean | number

  @ApiProperty()
  points: number
}

export class TrustScoreResponseDto {
  @ApiProperty({ format: "uuid" })
  userId: string

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Nul tant que les données sont insuffisantes",
  })
  score: number | null

  @ApiProperty()
  isComplete: boolean

  @ApiProperty()
  identityScore: number

  @ApiProperty()
  propertyScore: number

  @ApiProperty()
  behaviorScore: number

  @ApiProperty({ description: "Toujours 0 : aucune donnée de transaction" })
  transactionScore: number

  @ApiProperty()
  algorithmVersion: string

  @ApiProperty({ type: [ScoreFactorDto] })
  factors: ScoreFactorDto[]

  @ApiProperty()
  computedAt: string
}

// ------------------------------------------------------------ badges

export class BadgeDto {
  @ApiProperty({ enum: Object.values(BadgeCode) })
  code: BadgeCode

  @ApiProperty({ example: "Identité vérifiée" })
  label: string

  @ApiProperty()
  verifiedAt: string

  @ApiProperty({ type: String, nullable: true })
  expiresAt: string | null
}

export class UserBadgesResponseDto {
  @ApiProperty({ format: "uuid" })
  userId: string

  @ApiProperty({ type: [BadgeDto] })
  badges: BadgeDto[]

  @ApiProperty()
  disclaimer: string
}

export class ListingBadgesResponseDto {
  @ApiProperty({ format: "uuid" })
  listingId: string

  @ApiProperty({ type: [BadgeDto] })
  badges: BadgeDto[]

  @ApiProperty({ type: [BadgeDto] })
  publisherBadges: BadgeDto[]

  @ApiPropertyOptional({
    description: "Un dossier est en cours d'examen : information, pas un badge",
  })
  verificationInProgress: boolean

  @ApiProperty()
  disclaimer: string
}
