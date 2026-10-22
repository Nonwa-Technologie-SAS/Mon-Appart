/**
 * Utilitaires réseau pour connexions mobiles instables.
 * Pas de retry automatique sur POST/mutateurs (non idempotents).
 */

export class NetworkTimeoutError extends Error {
  constructor(message = "Délai d’attente dépassé") {
    super(message)
    this.name = "NetworkTimeoutError"
  }
}

export class OfflineError extends Error {
  constructor(message = "Connexion indisponible") {
    super(message)
    this.name = "OfflineError"
  }
}

export function isProbablyOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  if (isProbablyOffline()) {
    throw new OfflineError()
  }

  const { timeoutMs = 20_000, signal, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort)

  try {
    return await fetch(input, { ...rest, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new NetworkTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

/** Message utilisateur court selon le type d’échec. */
export function networkErrorMessage(error: unknown): string {
  if (error instanceof OfflineError) {
    return "Connexion indisponible. Réessayez lorsque le réseau revient."
  }
  if (error instanceof NetworkTimeoutError) {
    return "Le serveur met trop de temps à répondre. Réessayez."
  }
  if (error instanceof TypeError) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion."
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Une erreur réseau est survenue. Réessayez."
}
