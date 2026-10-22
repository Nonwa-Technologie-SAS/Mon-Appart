import { authError, AuthErrorCode } from "./auth-errors"

/** NIST SP 800-63B : longueur plutôt que règles de composition. */
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "azertyuiop",
  "qwertyuiop",
  "motdepasse",
  "motdepasse1",
  "motdepasse123",
  "password123",
  "password1234",
  "iloveyou123",
  "abidjan2024",
  "abidjan2025",
  "abidjan2026",
  "monappart123",
  "0000000000",
  "1111111111",
])

export interface PasswordContext {
  email?: string | null
  phone?: string | null
}

export function passwordWeakness(
  password: string,
  context: PasswordContext = {},
): string | null {
  const length = [...password].length
  if (length < PASSWORD_MIN_LENGTH) return "too_short"
  if (length > PASSWORD_MAX_LENGTH) return "too_long"
  const lowered = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lowered)) return "common"
  if (new Set(lowered).size < 4) return "repetitive"
  const localPart = context.email?.split("@")[0]
  if (
    localPart &&
    localPart.length >= 4 &&
    lowered.includes(localPart.toLowerCase())
  ) {
    return "contains_identifier"
  }
  const digits = context.phone?.replace(/\D/g, "")
  if (digits && digits.length >= 8 && lowered.includes(digits.slice(-8))) {
    return "contains_identifier"
  }
  return null
}

export function assertPasswordStrength(
  password: string,
  context: PasswordContext = {},
): void {
  if (passwordWeakness(password, context)) {
    throw authError(AuthErrorCode.PASSWORD_TOO_WEAK)
  }
}
