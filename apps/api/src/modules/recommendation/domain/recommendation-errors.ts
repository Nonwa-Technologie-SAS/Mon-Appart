import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const RecommendationErrorCode = {
  INVALID_RECOMMENDATION_QUERY: "INVALID_RECOMMENDATION_QUERY",
  INVALID_PREFERENCES: "INVALID_PREFERENCES",
  BUDGET_PERIOD_REQUIRED: "BUDGET_PERIOD_REQUIRED",
  INVALID_CURSOR: "INVALID_CURSOR",
  LISTING_NOT_FOUND: "LISTING_NOT_FOUND",
  RECOMMENDATION_NOT_FOUND: "RECOMMENDATION_NOT_FOUND",
  RECOMMENDATIONS_UNAVAILABLE: "RECOMMENDATIONS_UNAVAILABLE",
} as const

export type RecommendationErrorCode =
  (typeof RecommendationErrorCode)[keyof typeof RecommendationErrorCode]

const DEFINITIONS: Record<RecommendationErrorCode, [HttpStatus, string]> = {
  INVALID_RECOMMENDATION_QUERY: [
    HttpStatus.BAD_REQUEST,
    "Paramètres de recommandation invalides",
  ],
  INVALID_PREFERENCES: [HttpStatus.BAD_REQUEST, "Préférences invalides"],
  BUDGET_PERIOD_REQUIRED: [
    HttpStatus.BAD_REQUEST,
    "Précisez la périodicité du budget (par mois, au total...)",
  ],
  INVALID_CURSOR: [HttpStatus.BAD_REQUEST, "Curseur de pagination invalide"],
  LISTING_NOT_FOUND: [HttpStatus.NOT_FOUND, "Annonce introuvable"],
  RECOMMENDATION_NOT_FOUND: [
    HttpStatus.NOT_FOUND,
    "Recommandation introuvable",
  ],
  RECOMMENDATIONS_UNAVAILABLE: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Recommandations momentanément indisponibles",
  ],
}

/** `detail` ne contient que des noms de paramètres ou des bornes, jamais l'entrée brute. */
export function recommendationError(
  code: RecommendationErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
