import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max"

import { authError, AuthErrorCode } from "./auth-errors"

export const DEFAULT_PHONE_COUNTRY: CountryCode = "CI"

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export type Identifier =
  { kind: "email"; value: string } | { kind: "phone"; value: string }

/** Email en minuscules, sans espaces autour. `null` si le format est invalide. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null
  return email
}

/**
 * Numéro au format E.164. Les numéros locaux sont interprétés pour la Côte
 * d'Ivoire (+225). `null` si libphonenumber ne le reconnaît pas comme valide.
 */
export function normalizePhone(
  input: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  const phone = parsePhoneNumberFromString(input.trim(), country)
  if (!phone || !phone.isValid()) return null
  return phone.number
}

/** Un identifiant contenant `@` est un email, sinon un téléphone. */
export function parseIdentifier(input: string): Identifier | null {
  if (input.includes("@")) {
    const email = normalizeEmail(input)
    return email ? { kind: "email", value: email } : null
  }
  const phone = normalizePhone(input)
  return phone ? { kind: "phone", value: phone } : null
}

export function requireEmail(input: string): string {
  const email = normalizeEmail(input)
  if (!email) throw authError(AuthErrorCode.INVALID_EMAIL)
  return email
}

export function requirePhone(input: string): string {
  const phone = normalizePhone(input)
  if (!phone) throw authError(AuthErrorCode.INVALID_PHONE)
  return phone
}
