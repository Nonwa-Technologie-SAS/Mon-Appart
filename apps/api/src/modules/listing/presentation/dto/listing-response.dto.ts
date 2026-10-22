import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import {
  ListingStatus,
  ListingType,
  OwnershipType,
  PricePeriod,
} from "../../../../generated/prisma/enums"
import {
  AmenityResponseDto,
  MediaSummaryDto,
  PropertyLocationDto,
  PropertyTypeResponseDto,
} from "../../../property"

export class PriceResponseDto {
  @ApiProperty({
    example: "1500000",
    description: "NUMERIC sérialisé en chaîne",
  })
  amount: string

  @ApiProperty({ example: "XOF" })
  currency: string

  @ApiProperty({ enum: Object.values(PricePeriod) })
  period: PricePeriod
}

export class PriceHistoryEntryDto extends PriceResponseDto {
  @ApiProperty({ type: String, format: "date-time" })
  validFrom: string

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  validTo: string | null
}

export class StatusHistoryEntryDto {
  @ApiProperty({ enum: Object.values(ListingStatus), nullable: true })
  oldStatus: ListingStatus | null

  @ApiProperty({ enum: Object.values(ListingStatus) })
  newStatus: ListingStatus

  @ApiProperty({ type: String, nullable: true })
  reason: string | null

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  changedBy: string | null

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string
}

export class ListingHistoryResponseDto {
  @ApiProperty({ type: [PriceHistoryEntryDto] })
  prices: PriceHistoryEntryDto[]

  @ApiProperty({ type: [StatusHistoryEntryDto] })
  statuses: StatusHistoryEntryDto[]
}

export class ListingPropertyDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ type: PropertyTypeResponseDto })
  propertyType: PropertyTypeResponseDto

  @ApiProperty({ type: String, nullable: true })
  surface: string | null

  @ApiProperty({ type: String, nullable: true })
  landSurface: string | null

  @ApiProperty({ type: Number, nullable: true })
  bedrooms: number | null

  @ApiProperty({ type: Number, nullable: true })
  bathrooms: number | null
}

export class ListingPropertyDetailDto extends ListingPropertyDto {
  @ApiProperty()
  title: string

  @ApiProperty({ type: Number, nullable: true })
  rooms: number | null

  @ApiProperty({ type: [AmenityResponseDto] })
  amenities: AmenityResponseDto[]
}

export class ListingSummaryResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(ListingType) })
  listingType: ListingType

  @ApiProperty()
  title: string

  @ApiProperty({ type: PriceResponseDto, nullable: true })
  price: PriceResponseDto | null

  @ApiProperty({ type: ListingPropertyDto })
  property: ListingPropertyDto

  @ApiProperty({ type: PropertyLocationDto })
  location: PropertyLocationDto

  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  publishedAt: string | null

  @ApiPropertyOptional({
    enum: Object.values(ListingStatus),
    description: "Vue privée uniquement",
  })
  status?: ListingStatus

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description: "Vue privée uniquement",
  })
  expiresAt?: string | null
}

export class ListingResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(ListingType) })
  listingType: ListingType

  @ApiProperty({ enum: Object.values(ListingStatus) })
  status: ListingStatus

  @ApiProperty()
  title: string

  @ApiProperty({ type: String, nullable: true })
  description: string | null

  @ApiProperty({ type: PriceResponseDto, nullable: true })
  price: PriceResponseDto | null

  @ApiProperty({ type: ListingPropertyDetailDto })
  property: ListingPropertyDetailDto

  @ApiProperty({ type: PropertyLocationDto })
  location: PropertyLocationDto

  @ApiProperty({ type: MediaSummaryDto })
  media: MediaSummaryDto

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  publishedAt: string | null

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt: string | null

  @ApiPropertyOptional({
    enum: Object.values(OwnershipType),
    nullable: true,
    description: "Vue privée : rattachement de l'utilisateur au bien",
  })
  relation?: OwnershipType | null

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "Vue privée uniquement",
  })
  createdAt?: string

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "Vue privée uniquement",
  })
  updatedAt?: string
}

export class ListingPageResponseDto {
  @ApiProperty({ type: [ListingSummaryResponseDto] })
  items: ListingSummaryResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}
