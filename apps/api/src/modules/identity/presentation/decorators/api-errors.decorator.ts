import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"

import { ErrorResponseDto } from "../dto/auth-response.dto"

const DESCRIPTIONS: Record<number, string> = {
  400: "Requête invalide (VALIDATION_FAILED, CONTACT_REQUIRED, RESET_TOKEN_*)",
  401: "Non authentifié (UNAUTHENTICATED, INVALID_CREDENTIALS, TOKEN_EXPIRED, TOKEN_INVALID, SESSION_REVOKED)",
  403: "Interdit (ACCOUNT_SUSPENDED, ACCOUNT_BANNED, ACCOUNT_INACTIVE, CSRF_INVALID, INSUFFICIENT_*)",
  404: "Introuvable (SESSION_NOT_FOUND)",
  409: "Conflit (EMAIL_ALREADY_USED, PHONE_ALREADY_USED, *_ALREADY_VERIFIED)",
  422: "Refus métier (PASSWORD_TOO_WEAK, INVALID_PHONE, OTP_INVALID, OTP_EXPIRED, ...)",
  429: "Limite atteinte (RATE_LIMITED, TOO_MANY_ATTEMPTS, OTP_COOLDOWN, OTP_MAX_ATTEMPTS) ; en-tête Retry-After",
  503: "Base de données indisponible (IDENTITY_UNAVAILABLE)",
}

export function ApiErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status],
        type: ErrorResponseDto,
      }),
    ),
  )
}
