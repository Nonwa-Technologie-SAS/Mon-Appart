import { ApiPropertyOptional } from "@nestjs/swagger"
import { SEARCH_FACETS, SEARCH_SORTS } from "@mon-appart/types"
import { IsOptional, IsString, MaxLength } from "class-validator"

import type { RawSearchParams } from "../../domain/search-query"

/**
 * Paramètres d'URL de `GET /search`. Reçus comme chaînes : la validation
 * sémantique (bornes, cohérence, codes d'erreur précis) est faite par
 * `parseSearchQuery`. Les listes sont séparées par des virgules.
 */
export class SearchQueryDto implements RawSearchParams {
  @ApiPropertyOptional({
    description: "Texte libre (120 caractères max).",
    example: "villa cocody",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string

  @ApiPropertyOptional({
    description: "RENT, SALE, SHORT_TERM_RENT, LEASE_TO_OWN (liste).",
    example: "RENT",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  listingType?: string

  @ApiPropertyOptional({
    description: "Codes de types de biens (liste).",
    example: "VILLA,HOUSE",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  propertyType?: string

  @ApiPropertyOptional({
    description: "Codes de villes, insensibles à la casse et aux accents.",
    example: "abidjan",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  city?: string

  @ApiPropertyOptional({ description: "Codes de communes.", example: "cocody" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  commune?: string

  @ApiPropertyOptional({
    description: "Codes de quartiers.",
    example: "riviera",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  neighborhood?: string

  @ApiPropertyOptional({
    description: "Latitude du centre (avec lng).",
    example: "5.3599",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  lat?: string

  @ApiPropertyOptional({
    description: "Longitude du centre (avec lat).",
    example: "-3.9875",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  lng?: string

  @ApiPropertyOptional({
    description: "Rayon en km (défaut 10, max SEARCH_MAX_RADIUS_KM).",
    example: "5",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  radius?: string

  @ApiPropertyOptional({
    description: "Prix courant minimal (XOF).",
    example: "100000",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  minPrice?: string

  @ApiPropertyOptional({
    description: "Prix courant maximal (XOF).",
    example: "500000",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  maxPrice?: string

  @ApiPropertyOptional({
    description:
      "Surface minimale (m², surface du terrain pour un terrain nu).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  minSurface?: string

  @ApiPropertyOptional({ description: "Surface maximale (m²)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  maxSurface?: string

  @ApiPropertyOptional({ description: "Surface de terrain minimale (m²)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  minLandSurface?: string

  @ApiPropertyOptional({ description: "Surface de terrain maximale (m²)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  maxLandSurface?: string

  @ApiPropertyOptional({ description: "Au moins N chambres.", example: "2" })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  bedrooms?: string

  @ApiPropertyOptional({ description: "Au plus N chambres." })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  maxBedrooms?: string

  @ApiPropertyOptional({ description: "Au moins N salles de bain." })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  bathrooms?: string

  @ApiPropertyOptional({
    description: "Codes d'équipements (liste).",
    example: "PARKING,SECURITY",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  amenities?: string

  @ApiPropertyOptional({
    description: "AND (défaut) : tous les équipements ; OR : au moins un.",
    enum: ["AND", "OR"],
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  amenitiesMode?: string

  @ApiPropertyOptional({
    description:
      "Défaut : RELEVANCE si q est fourni, sinon NEWEST. DISTANCE exige lat/lng.",
    enum: SEARCH_SORTS,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sort?: string

  @ApiPropertyOptional({
    description: "Curseur opaque renvoyé par la page précédente.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  cursor?: string

  @ApiPropertyOptional({
    description: "Taille de page (défaut 20, max 100).",
    example: "20",
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  limit?: string

  @ApiPropertyOptional({
    description: `Facettes demandées (liste) : ${SEARCH_FACETS.join(", ")}. Première page uniquement.`,
    example: "propertyTypes,communes,priceRanges",
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  facets?: string

  @ApiPropertyOptional({
    description:
      "true quand l'utilisateur valide la recherche : seule celle-ci est historisée.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  submit?: string
}

export class SuggestionQueryDto {
  @ApiPropertyOptional({
    description: "Saisie en cours (2 à 64 caractères).",
    example: "coc",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string

  @ApiPropertyOptional({
    description: "Nombre de suggestions (défaut 8, max 20).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  limit?: string
}
