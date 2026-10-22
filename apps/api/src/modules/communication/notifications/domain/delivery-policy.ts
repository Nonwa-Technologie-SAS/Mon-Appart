/**
 * Classement des échecs d'un fournisseur. Seules les erreurs passagères sont
 * retentées ; une erreur de destinataire, de contenu ou de configuration
 * échoue tout de suite (la retenter ne changerait rien).
 */
export type ProviderErrorKind =
  | "TEMPORARY"
  | "QUOTA"
  | "TIMEOUT"
  | "PERMANENT"
  | "VALIDATION"
  | "RECIPIENT"
  | "CONFIG"

export interface ProviderError {
  kind: ProviderErrorKind
  /** Code court sans donnée personnelle (ex. `SMTP_550`, `HTTP_503`). */
  code: string
}

export function isRetryable(kind: ProviderErrorKind): boolean {
  return kind === "TEMPORARY" || kind === "QUOTA" || kind === "TIMEOUT"
}

/**
 * Délai avant la tentative suivante : exponentiel, plafonné à 6 h, avec un
 * aléa de ±20 % pour étaler les reprises après une panne du fournisseur.
 */
export function retryDelayMs(
  attempt: number,
  baseSeconds: number,
  random: () => number = Math.random,
): number {
  const exponential = baseSeconds * 2 ** Math.max(0, attempt - 1)
  const capped = Math.min(exponential, 6 * 3_600)
  const jitter = 0.8 + random() * 0.4
  return Math.round(capped * jitter * 1_000)
}

export type DeliveryDecision =
  | { status: "SENT" }
  | { status: "RETRY"; delayMs: number }
  | { status: "FAILED"; fallback: boolean }

export function decide(input: {
  error: ProviderError | null
  attempt: number
  maxAttempts: number
  baseSeconds: number
  random?: () => number
}): DeliveryDecision {
  if (!input.error) return { status: "SENT" }
  if (isRetryable(input.error.kind) && input.attempt < input.maxAttempts) {
    return {
      status: "RETRY",
      delayMs: retryDelayMs(input.attempt, input.baseSeconds, input.random),
    }
  }
  // Une erreur de configuration est la nôtre : le repli n'a pas à la masquer.
  return { status: "FAILED", fallback: input.error.kind !== "CONFIG" }
}

/** Message d'erreur d'un fournisseur réduit à un code stockable (100 car.). */
export function errorLabel(error: ProviderError): string {
  return `${error.kind}:${error.code}`.slice(0, 100)
}
