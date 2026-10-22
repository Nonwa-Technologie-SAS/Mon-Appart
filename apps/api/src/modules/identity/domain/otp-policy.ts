import { randomInt } from "node:crypto"

export type OtpOutcome =
  "OK" | "INVALID" | "EXPIRED" | "MAX_ATTEMPTS" | "CONSUMED"

export interface OtpChallengeState {
  attempts: number
  maxAttempts: number
  expiresAt: Date
  consumedAt: Date | null
}

/** Code numérique uniforme (CSPRNG), zéros initiaux conservés. */
export function generateOtpCode(length: number): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, "0")
}

/** État d'un défi avant comparaison du code. */
export function otpPrecheck(
  challenge: OtpChallengeState,
  now: Date,
): OtpOutcome {
  if (challenge.consumedAt) return "CONSUMED"
  if (challenge.expiresAt.getTime() <= now.getTime()) return "EXPIRED"
  if (challenge.attempts >= challenge.maxAttempts) return "MAX_ATTEMPTS"
  return "OK"
}

/** Décision complète ; `matches` compare le code en temps constant. */
export function evaluateOtp(
  challenge: OtpChallengeState,
  now: Date,
  matches: () => boolean,
): OtpOutcome {
  const precheck = otpPrecheck(challenge, now)
  if (precheck !== "OK") return precheck
  return matches() ? "OK" : "INVALID"
}
