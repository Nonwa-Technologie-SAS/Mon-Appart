import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
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
  ValidateIf,
} from "class-validator"

import {
  BillingIncidentStatus,
  BillingOrderStatus,
  BillingProductStatus,
  PaymentEventOutcome,
  PaymentStatus,
  RefundStatus,
  SubscriptionStatus,
} from "../../../generated/prisma/enums"
import { SUPPORTED_CURRENCIES } from "../domain/money"

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/
const AMOUNT = /^[1-9]\d{0,12}$/
const PRODUCT_CODE = /^[A-Z][A-Z0-9_]{1,63}$/

export class CursorQueryDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Identifiant public du dernier élément reçu.",
  })
  @IsOptional()
  @IsUUID("4")
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

// ------------------------------------------------------------ client

export class CreateOrderDto {
  @ApiProperty({
    example: "PRO",
    description: "Code du plan. Le montant est fixé par le serveur.",
  })
  @Matches(PRODUCT_CODE)
  productCode: string

  @ApiProperty({
    example: "4f9c1d2e-7a1b",
    description:
      "Clé d'idempotence choisie par le client (8 à 64 caractères `A-Za-z0-9_-`) : un renvoi renvoie la même commande.",
  })
  @Matches(IDEMPOTENCY_KEY)
  idempotencyKey: string
}

export class RefundRequestDto {
  @ApiPropertyOptional({
    example: "5000",
    description:
      "Montant entier en unités de la devise ; par défaut, tout le remboursable.",
  })
  @IsOptional()
  @Matches(AMOUNT)
  amount?: string

  @ApiProperty({ minLength: 10, maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string

  @ApiProperty({
    description: "Clé d'idempotence (8 à 64 caractères `A-Za-z0-9_-`).",
  })
  @Matches(IDEMPOTENCY_KEY)
  idempotencyKey: string
}

export class MockSimulationDto {
  @ApiProperty({ enum: ["SUCCEEDED", "FAILED", "CANCELLED"] })
  @IsIn(["SUCCEEDED", "FAILED", "CANCELLED"])
  outcome: "SUCCEEDED" | "FAILED" | "CANCELLED"
}

// ------------------------------------------------------------ back-office

export class OrderListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(BillingOrderStatus) })
  @IsOptional()
  @IsIn(Object.values(BillingOrderStatus))
  status?: BillingOrderStatus
}

export class PaymentListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(PaymentStatus) })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  status?: PaymentStatus
}

export class SubscriptionListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(SubscriptionStatus) })
  @IsOptional()
  @IsIn(Object.values(SubscriptionStatus))
  status?: SubscriptionStatus
}

export class RefundListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(RefundStatus) })
  @IsOptional()
  @IsIn(Object.values(RefundStatus))
  status?: RefundStatus
}

export class IncidentListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(BillingIncidentStatus) })
  @IsOptional()
  @IsIn(Object.values(BillingIncidentStatus))
  status?: BillingIncidentStatus
}

export class WebhookEventQueryDto {
  @ApiPropertyOptional({ enum: Object.values(PaymentEventOutcome) })
  @IsOptional()
  @IsIn(Object.values(PaymentEventOutcome))
  outcome?: PaymentEventOutcome

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  before?: Date

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class DecisionNoteDto {
  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    description: "Justification interne, conservée dans le journal d'audit.",
  })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  note: string
}

export class ResolveIncidentDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  resolution: string
}

export class CreateProductDto {
  @ApiProperty({ example: "PRO", description: "Immuable." })
  @Matches(PRODUCT_CODE)
  code: string

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    maximum: 100000,
    description: "`null` : illimité.",
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100_000)
  maxActiveListings?: number | null

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number
}

export class UpdateProductDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @ApiPropertyOptional({ enum: Object.values(BillingProductStatus) })
  @IsOptional()
  @IsIn(Object.values(BillingProductStatus))
  status?: BillingProductStatus

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    maximum: 100000,
    description: "`null` : illimité.",
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100_000)
  maxActiveListings?: number | null

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number
}

export class CreatePriceDto {
  @ApiProperty({
    example: "15000",
    description: "Entier en unités de la devise (XOF : francs).",
  })
  @Matches(AMOUNT)
  amount: string

  @ApiProperty({ enum: SUPPORTED_CURRENCIES })
  @IsIn([...SUPPORTED_CURRENCIES])
  currency: string

  @ApiProperty({ minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  intervalMonths: number

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date
}
