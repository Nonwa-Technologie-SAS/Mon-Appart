/**
 * Attribution d’acquisition (UTM + referrer host).
 * Codes normalisés uniquement — jamais d’URL complète ni de PII.
 */

export const ACQUISITION_CHANNELS = [
  "ORGANIC_SEARCH",
  "PAID",
  "SOCIAL",
  "EMAIL",
  "MESSAGING",
  "PARTNER",
  "REFERRAL",
  "DIRECT",
  "UNKNOWN",
] as const

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number]

export const ACQUISITION_TOUCH_KINDS = ["FIRST", "SESSION"] as const
export type AcquisitionTouchKind = (typeof ACQUISITION_TOUCH_KINDS)[number]

export type AcquisitionTouch = {
  channel: AcquisitionChannel
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrerHost: string | null
  landingRoute: string
  touchKind: AcquisitionTouchKind
}

const CODE_MAX = 40

/** Normalise un paramètre de campagne en code catalogue `[A-Z0-9_]{1,40}`. */
export function normalizeCampaignCode(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const code = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CODE_MAX)
  return code.length > 0 ? code : null
}

/** Extrait le host du referrer (sans chemin ni requête). */
export function referrerHostFromUrl(
  referrer: string | null | undefined,
): string | null {
  if (!referrer?.trim()) return null
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (!host || host === "localhost" || host.endsWith(".local")) return null
    return normalizeCampaignCode(host.replace(/\./g, "_"))
  } catch {
    return null
  }
}

const ORGANIC_HOSTS = [
  "GOOGLE",
  "BING",
  "YAHOO",
  "DUCKDUCKGO",
  "ECOSIA",
  "QWANT",
]
const SOCIAL_HOSTS = [
  "FACEBOOK",
  "FB",
  "INSTAGRAM",
  "TWITTER",
  "X",
  "TIKTOK",
  "LINKEDIN",
  "WHATSAPP",
  "TELEGRAM",
]

function hostLooksLike(host: string | null, needles: readonly string[]) {
  if (!host) return false
  return needles.some((n) => host.includes(n))
}

/**
 * Classe un canal à partir des UTM et du referrer.
 * Hypothèse documentée — pas une vérité publicitaire connectée.
 */
export function classifyAcquisitionChannel(input: {
  utmSource: string | null
  utmMedium: string | null
  referrerHost: string | null
}): AcquisitionChannel {
  const medium = input.utmMedium
  const source = input.utmSource

  if (medium) {
    if (
      medium.includes("CPC") ||
      medium.includes("PPC") ||
      medium.includes("PAID") ||
      medium === "ADS"
    ) {
      return "PAID"
    }
    if (medium.includes("EMAIL") || medium === "NEWSLETTER") return "EMAIL"
    if (
      medium.includes("SMS") ||
      medium.includes("WHATSAPP") ||
      medium.includes("MSG")
    ) {
      return "MESSAGING"
    }
    if (medium.includes("SOCIAL") || medium.includes("SOCIAL_ORGANIC")) {
      return "SOCIAL"
    }
    if (medium.includes("PARTNER") || medium.includes("AFFILIATE")) {
      return "PARTNER"
    }
    if (medium.includes("REFERRAL")) return "REFERRAL"
    if (medium.includes("ORGANIC")) return "ORGANIC_SEARCH"
  }

  if (source) {
    if (
      source.includes("GOOGLE") ||
      source.includes("BING") ||
      source === "SEO"
    ) {
      if (medium?.includes("CPC") || medium?.includes("PAID")) return "PAID"
      return "ORGANIC_SEARCH"
    }
    if (hostLooksLike(source, SOCIAL_HOSTS)) return "SOCIAL"
    if (source.includes("PARTNER")) return "PARTNER"
  }

  if (hostLooksLike(input.referrerHost, ORGANIC_HOSTS)) return "ORGANIC_SEARCH"
  if (hostLooksLike(input.referrerHost, SOCIAL_HOSTS)) return "SOCIAL"
  if (input.referrerHost) return "REFERRAL"
  if (!source && !medium && !input.referrerHost) return "DIRECT"
  return "UNKNOWN"
}

export type RawAcquisitionInput = {
  searchParams: URLSearchParams | Record<string, string | undefined>
  referrer?: string | null
  landingRoute: string
  touchKind?: AcquisitionTouchKind
}

function param(
  params: URLSearchParams | Record<string, string | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key)
  }
  return params[key] ?? null
}

/** Construit un touch d’acquisition prêt pour `acquisition_touch`. */
export function buildAcquisitionTouch(
  input: RawAcquisitionInput,
): AcquisitionTouch {
  const utmSource = normalizeCampaignCode(
    param(input.searchParams, "utm_source"),
  )
  const utmMedium = normalizeCampaignCode(
    param(input.searchParams, "utm_medium"),
  )
  const utmCampaign = normalizeCampaignCode(
    param(input.searchParams, "utm_campaign"),
  )
  const referrerHost = referrerHostFromUrl(input.referrer)
  return {
    channel: classifyAcquisitionChannel({
      utmSource,
      utmMedium,
      referrerHost,
    }),
    utmSource,
    utmMedium,
    utmCampaign,
    referrerHost,
    landingRoute: input.landingRoute,
    touchKind: input.touchKind ?? "SESSION",
  }
}

/** Vrai s’il y a quelque chose d’attributable au-delà du direct nu. */
export function hasAttributionSignal(touch: AcquisitionTouch): boolean {
  return (
    touch.utmSource != null ||
    touch.utmMedium != null ||
    touch.utmCampaign != null ||
    touch.referrerHost != null ||
    touch.channel !== "DIRECT"
  )
}
