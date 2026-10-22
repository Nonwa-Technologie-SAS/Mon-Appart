export const IdentityEvent = {
  UserRegistered: "identity.user_registered",
  UserLoggedIn: "identity.user_logged_in",
  UserLoggedOut: "identity.user_logged_out",
  PasswordChanged: "identity.password_changed",
  PasswordResetRequested: "identity.password_reset_requested",
  PasswordResetCompleted: "identity.password_reset_completed",
  EmailVerified: "identity.email_verified",
  PhoneVerified: "identity.phone_verified",
  SessionCreated: "identity.session_created",
  SessionRevoked: "identity.session_revoked",
  RefreshTokenRotated: "identity.refresh_token_rotated",
  RefreshTokenReuseDetected: "identity.refresh_token_reuse_detected",
  RoleChanged: "identity.role_changed",
  AccountStatusChanged: "identity.account_status_changed",
} as const

export type IdentityEventName =
  (typeof IdentityEvent)[keyof typeof IdentityEvent]

export const AuditAction = {
  USER_REGISTERED: "USER_REGISTERED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  SESSION_REVOKED: "SESSION_REVOKED",
  REFRESH_TOKEN_REUSE_DETECTED: "REFRESH_TOKEN_REUSE_DETECTED",
  ROLE_CHANGED: "ROLE_CHANGED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  PHONE_VERIFIED: "PHONE_VERIFIED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_BANNED: "ACCOUNT_BANNED",
  ACCOUNT_REACTIVATED: "ACCOUNT_REACTIVATED",
} as const

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]

export const SessionRevocationReason = {
  ROTATED: "ROTATED",
  LOGOUT: "LOGOUT",
  LOGOUT_ALL: "LOGOUT_ALL",
  USER_REVOKED: "USER_REVOKED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  REUSE_DETECTED: "REUSE_DETECTED",
  ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
} as const

export type SessionRevocationReason =
  (typeof SessionRevocationReason)[keyof typeof SessionRevocationReason]
