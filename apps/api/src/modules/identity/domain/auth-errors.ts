import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

export const AuthErrorCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_CURRENT_PASSWORD: "INVALID_CURRENT_PASSWORD",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_BANNED: "ACCOUNT_BANNED",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  ACCOUNT_ALREADY_EXISTS: "ACCOUNT_ALREADY_EXISTS",
  EMAIL_ALREADY_USED: "EMAIL_ALREADY_USED",
  PHONE_ALREADY_USED: "PHONE_ALREADY_USED",
  CONTACT_REQUIRED: "CONTACT_REQUIRED",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_PHONE: "INVALID_PHONE",
  PASSWORD_TOO_WEAK: "PASSWORD_TOO_WEAK",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  SESSION_REVOKED: "SESSION_REVOKED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  CSRF_INVALID: "CSRF_INVALID",
  OTP_INVALID: "OTP_INVALID",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_MAX_ATTEMPTS: "OTP_MAX_ATTEMPTS",
  OTP_COOLDOWN: "OTP_COOLDOWN",
  RESET_TOKEN_INVALID: "RESET_TOKEN_INVALID",
  RESET_TOKEN_EXPIRED: "RESET_TOKEN_EXPIRED",
  EMAIL_MISSING: "EMAIL_MISSING",
  PHONE_MISSING: "PHONE_MISSING",
  EMAIL_ALREADY_VERIFIED: "EMAIL_ALREADY_VERIFIED",
  PHONE_ALREADY_VERIFIED: "PHONE_ALREADY_VERIFIED",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  INSUFFICIENT_PERMISSION: "INSUFFICIENT_PERMISSION",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  RATE_LIMITED: "RATE_LIMITED",
  IDENTITY_UNAVAILABLE: "IDENTITY_UNAVAILABLE",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  SELF_ADMINISTRATION_FORBIDDEN: "SELF_ADMINISTRATION_FORBIDDEN",
  LAST_SUPER_ADMIN: "LAST_SUPER_ADMIN",
  ACCOUNT_STATUS_CHANGED: "ACCOUNT_STATUS_CHANGED",
  INVALID_STATUS_CHANGE: "INVALID_STATUS_CHANGE",
} as const

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode]

const DEFINITIONS: Record<AuthErrorCode, [HttpStatus, string]> = {
  INVALID_CREDENTIALS: [HttpStatus.UNAUTHORIZED, "Identifiants invalides"],
  INVALID_CURRENT_PASSWORD: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Mot de passe actuel incorrect",
  ],
  ACCOUNT_SUSPENDED: [HttpStatus.FORBIDDEN, "Compte suspendu"],
  ACCOUNT_BANNED: [HttpStatus.FORBIDDEN, "Compte banni"],
  ACCOUNT_INACTIVE: [HttpStatus.FORBIDDEN, "Compte désactivé"],
  ACCOUNT_ALREADY_EXISTS: [
    HttpStatus.CONFLICT,
    "Un compte existe déjà avec ces coordonnées",
  ],
  EMAIL_ALREADY_USED: [HttpStatus.CONFLICT, "Adresse email déjà utilisée"],
  PHONE_ALREADY_USED: [HttpStatus.CONFLICT, "Numéro de téléphone déjà utilisé"],
  CONTACT_REQUIRED: [HttpStatus.BAD_REQUEST, "Email ou téléphone requis"],
  INVALID_EMAIL: [HttpStatus.UNPROCESSABLE_ENTITY, "Adresse email invalide"],
  INVALID_PHONE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Numéro de téléphone invalide",
  ],
  PASSWORD_TOO_WEAK: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Mot de passe trop faible",
  ],
  UNAUTHENTICATED: [HttpStatus.UNAUTHORIZED, "Authentification requise"],
  TOKEN_EXPIRED: [HttpStatus.UNAUTHORIZED, "Jeton expiré"],
  TOKEN_INVALID: [HttpStatus.UNAUTHORIZED, "Jeton invalide"],
  SESSION_REVOKED: [HttpStatus.UNAUTHORIZED, "Session révoquée"],
  SESSION_NOT_FOUND: [HttpStatus.NOT_FOUND, "Session introuvable"],
  CSRF_INVALID: [HttpStatus.FORBIDDEN, "Jeton CSRF invalide"],
  OTP_INVALID: [HttpStatus.UNPROCESSABLE_ENTITY, "Code invalide"],
  OTP_EXPIRED: [HttpStatus.UNPROCESSABLE_ENTITY, "Code expiré"],
  OTP_MAX_ATTEMPTS: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Nombre d'essais dépassé, demandez un nouveau code",
  ],
  OTP_COOLDOWN: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Patientez avant de demander un nouveau code",
  ],
  RESET_TOKEN_INVALID: [
    HttpStatus.BAD_REQUEST,
    "Lien de réinitialisation invalide",
  ],
  RESET_TOKEN_EXPIRED: [
    HttpStatus.BAD_REQUEST,
    "Lien de réinitialisation expiré",
  ],
  EMAIL_MISSING: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Aucune adresse email sur le compte",
  ],
  PHONE_MISSING: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Aucun numéro de téléphone sur le compte",
  ],
  EMAIL_ALREADY_VERIFIED: [HttpStatus.CONFLICT, "Adresse email déjà vérifiée"],
  PHONE_ALREADY_VERIFIED: [
    HttpStatus.CONFLICT,
    "Numéro de téléphone déjà vérifié",
  ],
  INSUFFICIENT_ROLE: [HttpStatus.FORBIDDEN, "Rôle insuffisant"],
  INSUFFICIENT_PERMISSION: [HttpStatus.FORBIDDEN, "Permission insuffisante"],
  TOO_MANY_ATTEMPTS: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Trop de tentatives, réessayez plus tard",
  ],
  RATE_LIMITED: [
    HttpStatus.TOO_MANY_REQUESTS,
    "Trop de requêtes, réessayez plus tard",
  ],
  IDENTITY_UNAVAILABLE: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Service d'authentification indisponible",
  ],
  USER_NOT_FOUND: [HttpStatus.NOT_FOUND, "Utilisateur introuvable"],
  SELF_ADMINISTRATION_FORBIDDEN: [
    HttpStatus.FORBIDDEN,
    "Action impossible sur votre propre compte",
  ],
  LAST_SUPER_ADMIN: [
    HttpStatus.CONFLICT,
    "Le dernier super administrateur actif ne peut pas être retiré ni bloqué",
  ],
  ACCOUNT_STATUS_CHANGED: [
    HttpStatus.CONFLICT,
    "Le statut du compte a changé entre-temps : rechargez-le",
  ],
  INVALID_STATUS_CHANGE: [
    HttpStatus.CONFLICT,
    "Changement de statut du compte non autorisé",
  ],
}

export function authError(
  code: AuthErrorCode,
  retryAfterSeconds?: number,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(code, status, message, retryAfterSeconds)
}

export function authErrorStatus(code: AuthErrorCode): HttpStatus {
  return DEFINITIONS[code][0]
}
