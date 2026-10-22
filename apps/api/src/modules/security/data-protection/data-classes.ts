/**
 * Classification des données Mon Appart (technique, pas avis juridique).
 * Voir docs/data-protection.md.
 */
export const DataClass = {
  PUBLIC: "PUBLIC",
  INTERNAL: "INTERNAL",
  PERSONAL: "PERSONAL",
  SENSITIVE: "SENSITIVE",
  AUTH: "AUTH",
  FINANCIAL: "FINANCIAL",
  DOCUMENTARY: "DOCUMENTARY",
  ANTI_FRAUD: "ANTI_FRAUD",
} as const

export type DataClass = (typeof DataClass)[keyof typeof DataClass]

/** Champs jamais journalisés ni renvoyés hors canaux autorisés. */
export const NEVER_LOG_FIELDS = [
  "password",
  "passwordHash",
  "refreshToken",
  "accessToken",
  "otp",
  "otpCode",
  "code",
  "token",
  "secret",
  "cardNumber",
  "cvv",
  "authorization",
] as const
