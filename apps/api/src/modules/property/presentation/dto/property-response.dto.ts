import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import {
  AmenityCategory,
  ListingType,
  LocationVisibility,
  OwnershipType,
  PricePeriod,
  PropertyCategory,
  PropertyStatus,
} from "../../../../generated/prisma/enums"

export class PropertyTypeResponseDto {
  @ApiProperty({ example: "VILLA" })
  code: string

  @ApiProperty({ example: "Villa" })
  name: string

  @ApiProperty({ enum: Object.values(PropertyCategory) })
  category: PropertyCategory
}

export class AmenityResponseDto {
  @ApiProperty({ example: "PARKING" })
  code: string

  @ApiProperty({ example: "Parking" })
  name: string

  @ApiProperty({ enum: Object.values(AmenityCategory) })
  category: AmenityCategory
}

export class AreaRefDto {
  @ApiProperty({ example: "COCODY" })
  code: string

  @ApiProperty({ example: "Cocody" })
  name: string
}

export class PropertyLocationDto {
  @ApiProperty({ type: AreaRefDto })
  commune: AreaRefDto

  @ApiProperty({ type: AreaRefDto })
  neighborhood: AreaRefDto

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Arrondie (≈1 km) en APPROXIMATE, absente en HIDDEN (vue publique)",
  })
  latitude: number | null

  @ApiProperty({ type: Number, nullable: true })
  longitude: number | null

  @ApiProperty({ enum: ["EXACT", "APPROXIMATE", "NONE"] })
  precision: "EXACT" | "APPROXIMATE" | "NONE"

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Publique seulement en EXACT",
  })
  address: string | null
}

export class MediaSummaryDto {
  @ApiProperty({
    description: "Médias prêts (upload hors périmètre de ce module)",
  })
  count: number

  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null
}

export class PropertyListingSummaryDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ enum: Object.values(ListingType) })
  listingType: ListingType

  @ApiProperty()
  title: string

  @ApiProperty({
    type: String,
    nullable: true,
    example: "1500000",
    description: "NUMERIC sérialisé en chaîne",
  })
  amount: string | null

  @ApiProperty({ type: String, nullable: true, example: "XOF" })
  currency: string | null

  @ApiProperty({ enum: Object.values(PricePeriod), nullable: true })
  period: PricePeriod | null
}

export class CompletenessDto {
  @ApiProperty()
  complete: boolean

  @ApiProperty({ type: [String], example: ["coordinates"] })
  missing: string[]
}

export class PropertySummaryResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  title: string

  @ApiProperty({ type: PropertyTypeResponseDto })
  propertyType: PropertyTypeResponseDto

  @ApiProperty({ type: PropertyLocationDto })
  location: PropertyLocationDto

  @ApiProperty({ type: String, nullable: true, example: "280" })
  surface: string | null

  @ApiProperty({ type: String, nullable: true })
  landSurface: string | null

  @ApiProperty({ type: Number, nullable: true })
  bedrooms: number | null

  @ApiProperty({ type: Number, nullable: true })
  bathrooms: number | null

  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null

  @ApiPropertyOptional({
    enum: Object.values(PropertyStatus),
    description: "Vue privée uniquement",
  })
  status?: PropertyStatus

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string
}

export class PropertyResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty()
  title: string

  @ApiProperty({ type: String, nullable: true })
  description: string | null

  @ApiProperty({ type: PropertyTypeResponseDto })
  propertyType: PropertyTypeResponseDto

  @ApiProperty({ type: PropertyLocationDto })
  location: PropertyLocationDto

  @ApiProperty({ type: String, nullable: true, example: "280" })
  surface: string | null

  @ApiProperty({ type: String, nullable: true })
  landSurface: string | null

  @ApiProperty({ type: Number, nullable: true })
  bedrooms: number | null

  @ApiProperty({ type: Number, nullable: true })
  bathrooms: number | null

  @ApiProperty({ type: Number, nullable: true })
  rooms: number | null

  @ApiProperty({ type: Number, nullable: true })
  floor: number | null

  @ApiProperty({ type: Number, nullable: true })
  totalFloors: number | null

  @ApiProperty({ type: Number, nullable: true })
  yearBuilt: number | null

  @ApiProperty({ type: "object", additionalProperties: true })
  attributes: Record<string, unknown>

  @ApiProperty({ type: [AmenityResponseDto] })
  amenities: AmenityResponseDto[]

  @ApiProperty({ type: MediaSummaryDto })
  media: MediaSummaryDto

  @ApiProperty({
    type: [PropertyListingSummaryDto],
    description: "Annonces publiées",
  })
  listings: PropertyListingSummaryDto[]

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt: string

  @ApiPropertyOptional({
    enum: Object.values(PropertyStatus),
    description: "Vue privée uniquement",
  })
  status?: PropertyStatus

  @ApiPropertyOptional({
    enum: Object.values(LocationVisibility),
    description: "Vue privée uniquement",
  })
  locationVisibility?: LocationVisibility

  @ApiPropertyOptional({
    enum: Object.values(OwnershipType),
    nullable: true,
    description:
      "Vue privée : rattachement de l'utilisateur courant (null pour un admin)",
  })
  relation?: OwnershipType | null

  @ApiPropertyOptional({
    type: CompletenessDto,
    description: "Vue privée uniquement",
  })
  completeness?: CompletenessDto
}

export class PropertyPageResponseDto {
  @ApiProperty({ type: [PropertySummaryResponseDto] })
  items: PropertySummaryResponseDto[]

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null
}
