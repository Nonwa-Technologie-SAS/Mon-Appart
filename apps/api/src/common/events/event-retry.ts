/**
 * Délai avant la tentative suivante : exponentiel, plafonné à 6 h, aléa ±20 %.
 * Identique à la politique des livraisons de notification, sans y dépendre.
 */
export function outboxRetryDelayMs(
  attempt: number,
  baseSeconds: number,
  random: () => number = Math.random,
): number {
  const exponential = baseSeconds * 2 ** Math.max(0, attempt - 1)
  const capped = Math.min(exponential, 6 * 3_600)
  const jitter = 0.8 + random() * 0.4
  return Math.round(capped * jitter * 1_000)
}

export function isPermanentOutboxError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""
  return (
    message.startsWith("INVALID_EVENT") ||
    message.startsWith("PAYLOAD_TOO_LARGE") ||
    message.startsWith("FORBIDDEN_PAYLOAD")
  )
}
