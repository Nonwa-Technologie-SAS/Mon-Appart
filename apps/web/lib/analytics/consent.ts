const CONSENT_KEY = "mon-appart:analytics:consent:v1"
export const ANALYTICS_POLICY_VERSION = "2026-10"

export type StoredConsent = {
  granted: boolean
  policyVersion: string
  at: number
}

export function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    if (
      typeof parsed.granted !== "boolean" ||
      typeof parsed.policyVersion !== "string"
    ) {
      return null
    }
    if (parsed.policyVersion !== ANALYTICS_POLICY_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredConsent(granted: boolean): void {
  if (typeof window === "undefined") return
  try {
    const value: StoredConsent = {
      granted,
      policyVersion: ANALYTICS_POLICY_VERSION,
      at: Date.now(),
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredConsent(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    // ignore
  }
}
