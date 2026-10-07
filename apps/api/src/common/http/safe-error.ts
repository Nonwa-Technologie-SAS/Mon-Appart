export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue"
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/redis:\/\/\S+/gi, "[redacted]")
}
