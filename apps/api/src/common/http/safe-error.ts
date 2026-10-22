export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue"
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/redis:\/\/\S+/gi, "[redacted]")
    .replace(/(https?:\/\/)[^\s/@]+@/gi, "$1[redacted]@")
    .replace(
      /([?&](?:X-Amz-[A-Za-z-]+|Signature|token)=)[^&\s]+/gi,
      "$1[redacted]",
    )
}
