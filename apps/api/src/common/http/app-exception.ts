import { HttpException, HttpStatus } from "@nestjs/common"

/**
 * Erreur métier destinée au client : un code stable et un message sûr.
 * Le message ne doit jamais contenir de détail interne (requête SQL, secret, pile).
 */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    status: HttpStatus,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super({ code, message }, status)
  }
}

const DEFAULT_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
}

export function defaultErrorCode(status: number): string {
  if (status >= 500 && status !== 503) return "INTERNAL_ERROR"
  return DEFAULT_CODES[status] ?? "ERROR"
}
