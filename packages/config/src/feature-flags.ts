/**
 * Feature flags Mon Appart — registre env, sans fournisseur externe.
 * Un flag UI n’est jamais une autorisation : les contrôles métier restent serveur.
 */

export const FEATURE_FLAG_IDS = [
  "search_opensearch",
  "recommendation_remote",
  "metrics_scrape",
  "listing_moderation_required",
  "payment_mock",
  "swagger",
  "web_assistant",
  "web_recommendations",
  "partners_api",
] as const

export type FeatureFlagId = (typeof FEATURE_FLAG_IDS)[number]

export type FeatureFlagDefinition = {
  id: FeatureFlagId
  description: string
  /** Valeur si la variable n’est pas définie. */
  defaultEnabled: boolean
  /** Variable d’environnement primaire (documentation / override). */
  envKey: string
  /** true = impact sécurité/ops ; ne pas exposer au client. */
  serverOnly: boolean
}

export const FEATURE_FLAG_CATALOG: readonly FeatureFlagDefinition[] = [
  {
    id: "search_opensearch",
    description:
      "Utiliser OpenSearch comme moteur primaire (sinon PostgreSQL).",
    defaultEnabled: false,
    envKey: "SEARCH_ENGINE",
    serverOnly: true,
  },
  {
    id: "recommendation_remote",
    description: "Déléguer les reco au service FastAPI (sinon rules Nest).",
    defaultEnabled: false,
    envKey: "RECOMMENDATION_ENGINE",
    serverOnly: true,
  },
  {
    id: "metrics_scrape",
    description: "Exposer /metrics Prometheus (jeton requis).",
    defaultEnabled: false,
    envKey: "METRICS_ENABLED",
    serverOnly: true,
  },
  {
    id: "listing_moderation_required",
    description: "Première publication soumise à modération.",
    defaultEnabled: false,
    envKey: "LISTING_MODERATION_REQUIRED",
    serverOnly: true,
  },
  {
    id: "payment_mock",
    description: "Simulateur de paiement (refusé en staging/production).",
    defaultEnabled: false,
    envKey: "PAYMENT_PROVIDER",
    serverOnly: true,
  },
  {
    id: "swagger",
    description: "Documentation OpenAPI interactive.",
    defaultEnabled: false,
    envKey: "SWAGGER_ENABLED",
    serverOnly: true,
  },
  {
    id: "web_assistant",
    description: "UI assistant conversationnel (parcours public).",
    defaultEnabled: true,
    envKey: "FF_WEB_ASSISTANT",
    serverOnly: false,
  },
  {
    id: "web_recommendations",
    description: "UI recommandations personnalisées.",
    defaultEnabled: true,
    envKey: "FF_WEB_RECOMMENDATIONS",
    serverOnly: false,
  },
  {
    id: "partners_api",
    description: "API partenaires / imports (module Nest).",
    defaultEnabled: true,
    envKey: "FF_PARTNERS_API",
    serverOnly: true,
  },
] as const

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback
  const value = raw.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(value)) return true
  if (["0", "false", "no", "off"].includes(value)) return false
  return fallback
}

/**
 * Résout l’état des flags depuis un objet env injecté.
 * Fail-safe : valeur par défaut du catalogue si absente ou invalide.
 */
export function resolveFeatureFlags(
  env: Record<string, string | undefined>,
): Record<FeatureFlagId, boolean> {
  const searchEngine = env.SEARCH_ENGINE?.trim().toLowerCase()
  const recommendationEngine = env.RECOMMENDATION_ENGINE?.trim().toLowerCase()
  const paymentProvider = env.PAYMENT_PROVIDER?.trim().toLowerCase()
  const appEnv = env.APP_ENV?.trim().toLowerCase() ?? "local"

  const swaggerExplicit = env.SWAGGER_ENABLED?.trim().toLowerCase()
  const swaggerDefault = appEnv === "local" || appEnv === "development"

  return {
    search_opensearch: searchEngine === "opensearch",
    recommendation_remote: recommendationEngine === "remote",
    metrics_scrape: parseBool(env.METRICS_ENABLED, false),
    listing_moderation_required: parseBool(
      env.LISTING_MODERATION_REQUIRED,
      false,
    ),
    payment_mock: paymentProvider === "mock",
    swagger:
      swaggerExplicit === "true"
        ? true
        : swaggerExplicit === "false"
          ? false
          : swaggerDefault,
    web_assistant: parseBool(env.FF_WEB_ASSISTANT, true),
    web_recommendations: parseBool(env.FF_WEB_RECOMMENDATIONS, true),
    partners_api: parseBool(env.FF_PARTNERS_API, true),
  }
}

export function isFeatureEnabled(
  id: FeatureFlagId,
  env: Record<string, string | undefined>,
): boolean {
  return resolveFeatureFlags(env)[id]
}

/** Flags sûrs à exposer côté navigateur (préfixe NEXT_PUBLIC_ recommandé en build). */
export function publicFeatureFlags(
  env: Record<string, string | undefined>,
): Pick<
  Record<FeatureFlagId, boolean>,
  "web_assistant" | "web_recommendations"
> {
  const all = resolveFeatureFlags(env)
  return {
    web_assistant: all.web_assistant,
    web_recommendations: all.web_recommendations,
  }
}
