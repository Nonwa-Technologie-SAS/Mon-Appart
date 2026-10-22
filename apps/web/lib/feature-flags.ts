/**
 * Flags UI publics — lecture NEXT_PUBLIC_* / FF_* au build/runtime Next.
 * Ne jamais s’en servir pour autoriser une action sensible (toujours Nest).
 */

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback
  const value = raw.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(value)) return true
  if (["0", "false", "no", "off"].includes(value)) return false
  return fallback
}

export type WebFeatureFlags = {
  assistant: boolean
  recommendations: boolean
}

export function getWebFeatureFlags(): WebFeatureFlags {
  return {
    assistant: parseBool(
      process.env.NEXT_PUBLIC_FF_WEB_ASSISTANT ??
        process.env.FF_WEB_ASSISTANT,
      true,
    ),
    recommendations: parseBool(
      process.env.NEXT_PUBLIC_FF_WEB_RECOMMENDATIONS ??
        process.env.FF_WEB_RECOMMENDATIONS,
      true,
    ),
  }
}

export function isWebFeatureEnabled(
  flag: keyof WebFeatureFlags,
): boolean {
  return getWebFeatureFlags()[flag]
}
