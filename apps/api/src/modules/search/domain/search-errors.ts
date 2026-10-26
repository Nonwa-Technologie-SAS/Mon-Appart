import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const SearchErrorCode = {
  INVALID_SEARCH_QUERY: "INVALID_SEARCH_QUERY",
  INVALID_PRICE_RANGE: "INVALID_PRICE_RANGE",
  INVALID_SURFACE_RANGE: "INVALID_SURFACE_RANGE",
  INVALID_GEO_COORDINATES: "INVALID_GEO_COORDINATES",
  INVALID_RADIUS: "INVALID_RADIUS",
  INVALID_CURSOR: "INVALID_CURSOR",
  SEARCH_ENGINE_UNAVAILABLE: "SEARCH_ENGINE_UNAVAILABLE",
  SEARCH_TIMEOUT: "SEARCH_TIMEOUT",
  SAVED_SEARCH_NOT_FOUND: "SAVED_SEARCH_NOT_FOUND",
  SAVED_SEARCH_LIMIT: "SAVED_SEARCH_LIMIT",
  INVALID_SAVED_SEARCH: "INVALID_SAVED_SEARCH",
} as const

export type SearchErrorCode =
  (typeof SearchErrorCode)[keyof typeof SearchErrorCode]

const DEFINITIONS: Record<SearchErrorCode, [HttpStatus, string]> = {
  INVALID_SEARCH_QUERY: [HttpStatus.BAD_REQUEST, "Recherche invalide"],
  INVALID_PRICE_RANGE: [HttpStatus.BAD_REQUEST, "Fourchette de prix invalide"],
  INVALID_SURFACE_RANGE: [
    HttpStatus.BAD_REQUEST,
    "Fourchette de surface invalide",
  ],
  INVALID_GEO_COORDINATES: [
    HttpStatus.BAD_REQUEST,
    "Coordonnées géographiques invalides",
  ],
  INVALID_RADIUS: [HttpStatus.BAD_REQUEST, "Rayon de recherche invalide"],
  INVALID_CURSOR: [HttpStatus.BAD_REQUEST, "Curseur de pagination invalide"],
  SEARCH_ENGINE_UNAVAILABLE: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Recherche momentanément indisponible",
  ],
  SEARCH_TIMEOUT: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "La recherche a pris trop de temps",
  ],
  SAVED_SEARCH_NOT_FOUND: [
    HttpStatus.NOT_FOUND,
    "Recherche enregistrée introuvable",
  ],
  SAVED_SEARCH_LIMIT: [
    HttpStatus.CONFLICT,
    "Limite de recherches enregistrées atteinte",
  ],
  INVALID_SAVED_SEARCH: [
    HttpStatus.BAD_REQUEST,
    "Recherche enregistrée invalide",
  ],
}

/** `detail` ne contient que des noms de paramètres ou des bornes, jamais l'entrée brute. */
export function searchError(
  code: SearchErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
