import type { CookieOptions, Request, Response } from "express"

import { authError, AuthErrorCode } from "../../domain/auth-errors"
import type { IdentityConfig } from "../../identity.config"
import {
  generateOpaqueToken,
  safeEqual,
} from "../../infrastructure/crypto/secret-hasher"

export const REFRESH_COOKIE = "ma_refresh"
export const CSRF_COOKIE = "ma_csrf"
export const CSRF_HEADER = "x-csrf-token"
export const TRANSPORT_HEADER = "x-auth-transport"
const REFRESH_COOKIE_PATH = "/api/v1/auth"

/** Le client web demande le mode cookie ; le mobile garde le refresh token dans le corps. */
export function wantsCookieTransport(request: Request): boolean {
  return request.headers[TRANSPORT_HEADER] === "cookie"
}

function baseOptions(config: IdentityConfig): CookieOptions {
  return { secure: config.secureCookies, sameSite: "strict" }
}

/**
 * Refresh token en cookie HttpOnly limité aux routes d'authentification, et
 * jeton CSRF lisible par le front (double soumission).
 */
export function setAuthCookies(
  response: Response,
  config: IdentityConfig,
  refreshToken: string,
  expiresAt: Date,
): void {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now())
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(config),
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge,
  })
  response.cookie(CSRF_COOKIE, generateOpaqueToken(24), {
    ...baseOptions(config),
    httpOnly: false,
    path: "/",
    maxAge,
  })
}

export function clearAuthCookies(
  response: Response,
  config: IdentityConfig,
): void {
  response.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(config),
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
  })
  response.clearCookie(CSRF_COOKIE, { ...baseOptions(config), path: "/" })
}

/**
 * Refresh token du corps (mobile) ou du cookie (web). Le cookie n'est accepté
 * qu'avec un en-tête X-CSRF-Token égal au cookie CSRF.
 */
export function resolveRefreshToken(
  request: Request,
  bodyToken: string | undefined,
): { token: string; fromCookie: boolean } {
  if (bodyToken) return { token: bodyToken, fromCookie: false }
  const cookies = (request.cookies ?? {}) as Record<string, unknown>
  const cookieToken = cookies[REFRESH_COOKIE]
  if (typeof cookieToken !== "string" || cookieToken.length === 0) {
    throw authError(AuthErrorCode.UNAUTHENTICATED)
  }
  const csrfCookie = cookies[CSRF_COOKIE]
  const csrfHeader = request.headers[CSRF_HEADER]
  if (
    typeof csrfCookie !== "string" ||
    typeof csrfHeader !== "string" ||
    csrfCookie.length === 0 ||
    !safeEqual(csrfCookie, csrfHeader)
  ) {
    throw authError(AuthErrorCode.CSRF_INVALID)
  }
  return { token: cookieToken, fromCookie: true }
}
