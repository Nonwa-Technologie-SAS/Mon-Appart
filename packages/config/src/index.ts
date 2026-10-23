import { z } from "zod"

export {
  FEATURE_FLAG_CATALOG,
  FEATURE_FLAG_IDS,
  isFeatureEnabled,
  publicFeatureFlags,
  resolveFeatureFlags,
  type FeatureFlagDefinition,
  type FeatureFlagId,
} from "./feature-flags"

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
)

export const RECOMMENDATION_DIMENSIONS = [
  "budget",
  "location",
  "type",
  "size",
  "amenities",
  "behavior",
  "quality",
] as const

export type RecommendationDimension = (typeof RECOMMENDATION_DIMENSIONS)[number]

export const DEFAULT_RECOMMENDATION_WEIGHTS =
  "budget:30,location:20,type:15,size:10,amenities:10,behavior:10,quality:5"

/**
 * `budget:30,location:20,...` → poids en points. Toutes les dimensions sont
 * requises une fois, entières, et leur somme vaut 100. Lève une erreur sinon.
 */
export function parseRecommendationWeights(
  value: string,
): Record<RecommendationDimension, number> {
  const weights: Partial<Record<RecommendationDimension, number>> = {}
  for (const part of value.split(",")) {
    const [rawKey, rawValue] = part.split(":").map((item) => item.trim())
    const key = RECOMMENDATION_DIMENSIONS.find(
      (dimension) => dimension === rawKey,
    )
    if (!key || weights[key] !== undefined) {
      throw new Error(`dimension inconnue ou répétée : ${rawKey ?? ""}`)
    }
    if (!/^\d{1,3}$/.test(rawValue ?? "")) {
      throw new Error(`poids invalide pour ${key}`)
    }
    weights[key] = Number(rawValue)
  }
  const missing = RECOMMENDATION_DIMENSIONS.filter(
    (dimension) => weights[dimension] === undefined,
  )
  if (missing.length > 0) {
    throw new Error(`dimensions manquantes : ${missing.join(", ")}`)
  }
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  if (total !== 100) throw new Error(`somme des poids = ${total}, attendu 100`)
  return weights as Record<RecommendationDimension, number>
}

const FALLBACK_PATTERN = /^(EMAIL|SMS|PUSH|WHATSAPP)>(EMAIL|SMS|PUSH|WHATSAPP)$/

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["local", "test", "development", "staging", "production"])
    .default("local"),
  APP_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: optionalString,
  REDIS_URL: optionalString,
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_TTL: z.string().min(1).default("30d"),
  CORS_ORIGINS: z.string().default(""),
  /** Valeur Express `trust proxy` (ex. `1`, `loopback`). Vide : req.ip = adresse du socket. */
  TRUST_PROXY: optionalString,
  WEB_APP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  ADMIN_APP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  PASSWORD_RESET_TTL: z.string().min(1).default("30m"),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL: z.string().min(1).default("5m"),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  /** Secondes entre deux envois de code pour un même utilisateur et un même usage. */
  OTP_RESEND_COOLDOWN: z.coerce.number().int().min(0).default(60),
  /** Échecs de connexion tolérés par identifiant sur AUTH_LOGIN_FAILURE_WINDOW. */
  AUTH_MAX_LOGIN_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  /** Secondes. Fenêtre glissante du blocage temporaire par identifiant. */
  AUTH_LOGIN_FAILURE_WINDOW: z.coerce.number().int().min(1).default(900),
  /** Secondes. Fenêtre des limites par IP des endpoints d'authentification. */
  AUTH_RATE_LIMIT_WINDOW: z.coerce.number().int().min(1).default(60),
  AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
  AUTH_REGISTER_RATE_LIMIT: z.coerce.number().int().min(1).default(5),
  AUTH_OTP_RATE_LIMIT: z.coerce.number().int().min(1).default(5),
  AUTH_RESET_RATE_LIMIT: z.coerce.number().int().min(1).default(5),
  /** Affiche les codes OTP et liens de réinitialisation sur la console. Refusé hors local. */
  AUTH_DEV_PRINT_CODES: z.enum(["true", "false"]).default("false"),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(8_192).default(19_456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  /** Publication soumise à validation d'un modérateur (PENDING_REVIEW). */
  LISTING_MODERATION_REQUIRED: z.enum(["true", "false"]).default("false"),
  /** Durée de publication par défaut d'une annonce, en jours. */
  LISTING_DEFAULT_DURATION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(90),
  /** Moteur de recherche. PostgreSQL reste la source de vérité dans les deux cas. */
  SEARCH_ENGINE: z.enum(["postgres", "opensearch"]).default("postgres"),
  /** Repli si OpenSearch échoue : `postgres` (mode dégradé) ou `none` (erreur 503). */
  SEARCH_FALLBACK: z.enum(["postgres", "none"]).default("postgres"),
  OPENSEARCH_NODE: z.preprocess(emptyToUndefined, z.url().optional()),
  OPENSEARCH_USERNAME: optionalString,
  OPENSEARCH_PASSWORD: optionalString,
  /** Préfixe des index ; l'alias de lecture est `<prefix>_current`. */
  OPENSEARCH_INDEX_LISTINGS: z
    .string()
    .regex(/^[a-z][a-z0-9_-]*$/)
    .default("listings"),
  OPENSEARCH_TIMEOUT_MS: z.coerce.number().int().min(50).default(1_000),
  OPENSEARCH_MAX_RETRIES: z.coerce.number().int().min(0).max(2).default(1),
  /** Version du document indexé ; un changement de mapping l'incrémente. */
  SEARCH_INDEX_VERSION: z.coerce.number().int().min(1).default(1),
  SEARCH_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(100).default(20),
  SEARCH_MAX_LIMIT: z.coerce.number().int().min(1).max(100).default(100),
  SEARCH_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
  /** Plafonné à 100 km (contrainte `searches_radius_chk`). */
  SEARCH_MAX_RADIUS_KM: z.coerce.number().positive().max(100).default(50),
  SEARCH_REINDEX_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(10)
    .max(5_000)
    .default(500),
  /** Bornes des tranches de prix des facettes, en XOF, croissantes. */
  SEARCH_PRICE_FACET_BOUNDS: z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .default("100000,250000,500000,1000000,5000000,50000000"),
  /** Requêtes par minute et par IP. */
  SEARCH_RATE_LIMIT: z.coerce.number().int().min(1).default(60),
  SEARCH_SUGGEST_RATE_LIMIT: z.coerce.number().int().min(1).default(240),
  /** Synonymes `terme=equivalent|equivalent;...`, en minuscules sans accents. */
  SEARCH_SYNONYMS: z.string().default(""),
  /** `rules` : moteur déterministe NestJS ; `remote` : service Python, repli sur `rules`. */
  RECOMMENDATION_ENGINE: z.enum(["rules", "remote"]).default("rules"),
  /** Comparer le remote sans servir ses résultats (si engine=rules). */
  RECOMMENDATION_SHADOW: z.enum(["true", "false"]).default("false"),
  RECOMMENDATION_SERVICE_URL: z.preprocess(
    emptyToUndefined,
    z.url().optional(),
  ),
  RECOMMENDATION_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(50)
    .max(10_000)
    .default(800),
  RECOMMENDATION_DEFAULT_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20),
  RECOMMENDATION_MAX_LIMIT: z.coerce.number().int().min(1).max(50).default(50),
  /** Profondeur maximale paginable d'une liste de recommandations. */
  RECOMMENDATION_MAX_RESULTS: z.coerce
    .number()
    .int()
    .min(10)
    .max(500)
    .default(100),
  /** Annonces candidates lues en base avant scoring. */
  RECOMMENDATION_CANDIDATE_POOL: z.coerce
    .number()
    .int()
    .min(50)
    .max(2_000)
    .default(400),
  RECOMMENDATION_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),
  /** Durée de vie d'une recommandation persistée (`expires_at`). */
  RECOMMENDATION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  RECOMMENDATION_BEHAVIOR_LOOKBACK_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(90),
  RECOMMENDATION_BEHAVIOR_HALF_LIFE_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30),
  /** Âge au-delà duquel un profil comportemental est recalculé à la lecture. */
  RECOMMENDATION_PROFILE_MAX_AGE_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_080)
    .default(60),
  RECOMMENDATION_ENABLE_BEHAVIOR_SIGNALS: z
    .enum(["true", "false"])
    .default("true"),
  RECOMMENDATION_ENABLE_DIVERSIFICATION: z
    .enum(["true", "false"])
    .default("true"),
  /** 0 : pertinence seule ; 1 : diversité maximale. */
  RECOMMENDATION_DIVERSITY: z.coerce.number().min(0).max(1).default(0.3),
  /** Annonces d'un même publieur par page, s'il existe des alternatives. */
  RECOMMENDATION_MAX_PER_OWNER: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(2),
  /** Poids en points, somme = 100. Voir `parseRecommendationWeights`. */
  RECOMMENDATION_WEIGHTS: z.string().default(DEFAULT_RECOMMENDATION_WEIGHTS),
  RECOMMENDATION_RATE_LIMIT: z.coerce.number().int().min(1).default(60),
  RECOMMENDATION_FEEDBACK_RATE_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .default(120),
  /** `local` : disque, hors production ; `s3` / `r2` : stockage objet compatible S3. */
  MEDIA_STORAGE_PROVIDER: z.enum(["local", "s3", "r2"]).default("local"),
  /** Racine du stockage local. Vide : dossier temporaire du système. */
  MEDIA_LOCAL_ROOT: z.string().default(""),
  /** URL publique de l'API, base des liens d'upload et de lecture du stockage local. */
  MEDIA_LOCAL_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  /** Bucket public (CDN) des variantes d'images publiques. Vide : URL présignées. */
  S3_PUBLIC_BUCKET: z.string().default(""),
  /** URL de base du bucket public (domaine CDN), sans slash final. */
  MEDIA_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
  MEDIA_UPLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3_600)
    .default(900),
  MEDIA_DOWNLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3_600)
    .default(300),
  MEDIA_MAX_IMAGE_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .default(15 * 1024 * 1024),
  MEDIA_MAX_VIDEO_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .default(200 * 1024 * 1024),
  MEDIA_MAX_DOCUMENT_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .default(20 * 1024 * 1024),
  /** Garde-fou contre les images « bombes de décompression ». */
  MEDIA_MAX_IMAGE_PIXELS: z.coerce
    .number()
    .int()
    .min(1_000_000)
    .max(268_402_689)
    .default(50_000_000),
  MEDIA_MAX_VIDEO_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_600)
    .default(180),
  /** Médias non supprimés par bien, sessions en cours comprises. */
  MEDIA_MAX_PER_PROPERTY: z.coerce.number().int().min(1).max(200).default(30),
  /** Sessions d'upload ouvertes simultanément par utilisateur. */
  MEDIA_MAX_PENDING_UPLOADS: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20),
  /** Traitement en processus : désactivé, les médias restent en file. */
  MEDIA_WORKER_ENABLED: z.enum(["true", "false"]).default("true"),
  MEDIA_WORKER_POLL_MS: z.coerce
    .number()
    .int()
    .min(200)
    .max(60_000)
    .default(2_000),
  MEDIA_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  MEDIA_JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  MEDIA_JOB_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .default(60_000),
  /** Conservation des objets d'un média supprimé avant purge définitive. */
  MEDIA_DELETED_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .default(30),
  MEDIA_CLEANUP_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_440)
    .default(15),
  /** Requêtes par minute et par IP. */
  MEDIA_UPLOAD_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  MEDIA_MUTATION_RATE_LIMIT: z.coerce.number().int().min(1).default(60),
  /**
   * Vérifications exigées avant publication d'une annonce, séparées par des
   * virgules : IDENTITY (identité du publiant), PUBLICATION_RIGHT (droit de
   * publier le bien vérifié). Vide : aucune exigence.
   */
  LISTING_PUBLICATION_REQUIREMENTS: z
    .string()
    .default("")
    .refine(
      (value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .every((item) => ["IDENTITY", "PUBLICATION_RIGHT"].includes(item)),
      "valeurs admises : IDENTITY, PUBLICATION_RIGHT",
    ),
  /** Durée de validité d'une vérification approuvée, en jours. */
  TRUST_IDENTITY_VALIDITY_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_650)
    .default(730),
  TRUST_PROPERTY_VALIDITY_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_650)
    .default(365),
  TRUST_AGENCY_VALIDITY_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_650)
    .default(365),
  TRUST_LISTING_CHECK_VALIDITY_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(730)
    .default(180),
  /** Conservation des pièces après la clôture d'un dossier, avant purge. */
  TRUST_DOCUMENT_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_650)
    .default(365),
  TRUST_MAX_DOCUMENTS_PER_VERIFICATION: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10),
  /** Déclarants distincts au-delà desquels une cible signalée est priorisée. */
  TRUST_REPORT_REVIEW_THRESHOLD: z.coerce
    .number()
    .int()
    .min(2)
    .max(100)
    .default(3),
  /** Variation relative de prix à partir de laquelle une alerte est créée (0.5 = ±50 %). */
  TRUST_PRICE_CHANGE_ALERT_RATIO: z.coerce
    .number()
    .min(0.1)
    .max(10)
    .default(0.5),
  /** Signalements par utilisateur et par jour. */
  TRUST_REPORT_DAILY_LIMIT: z.coerce.number().int().min(1).max(500).default(20),
  /** Requêtes par minute et par IP. */
  TRUST_REPORT_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
  TRUST_MUTATION_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  /** Expiration des dossiers et rétention des pièces ; 0 désactive la tâche en processus. */
  TRUST_MAINTENANCE_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_440)
    .default(60),
  /** Conversations ouvertes par utilisateur et par heure. */
  MESSAGING_MAX_CONVERSATIONS_PER_HOUR: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(20),
  /** Messages envoyés par utilisateur et par minute, toutes conversations. */
  MESSAGING_MAX_MESSAGES_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(30),
  /** Conversations distinctes recevant le même texte en une heure avant refus. */
  MESSAGING_REPEAT_LIMIT: z.coerce.number().int().min(2).max(100).default(5),
  MESSAGING_MAX_ATTACHMENTS: z.coerce.number().int().min(1).max(10).default(5),
  /** Délai avant e-mail/SMS/push d'un message non lu ; annulé s'il est lu entre-temps. */
  MESSAGING_EXTERNAL_DELAY_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(86_400)
    .default(300),
  /** Requêtes par minute et par IP. */
  MESSAGING_RATE_LIMIT: z.coerce.number().int().min(1).default(120),
  /** Livraison des notifications en processus : désactivé, les livraisons restent en file. */
  NOTIFICATION_WORKER_ENABLED: z.enum(["true", "false"]).default("true"),
  NOTIFICATION_WORKER_POLL_MS: z.coerce
    .number()
    .int()
    .min(200)
    .max(60_000)
    .default(2_000),
  NOTIFICATION_WORKER_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  /** Base du backoff exponentiel entre deux tentatives, avec aléa. */
  NOTIFICATION_RETRY_BASE_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_600)
    .default(30),
  NOTIFICATION_PROVIDER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(60_000)
    .default(10_000),
  /**
   * Replis après échec définitif, `CANAL>CANAL` séparés par des virgules
   * (ex. `EMAIL>SMS`). Le canal de repli n'est pas envoyé en parallèle du
   * canal principal, seulement après son échec. Un seul niveau : les chaînes
   * et les cycles sont ignorés.
   */
  NOTIFICATION_FALLBACKS: z
    .string()
    .default("")
    .refine(
      (value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .every((item) => {
            const match = FALLBACK_PATTERN.exec(item)
            return match !== null && match[1] !== match[2]
          }),
      "format CANAL>CANAL (EMAIL, SMS, PUSH, WHATSAPP), canaux distincts",
    ),
  /** `none` : canal désactivé, aucune livraison planifiée. */
  EMAIL_PROVIDER: z.enum(["none", "smtp"]).default("none"),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  /** `true` : TLS implicite (port 465). `false` : STARTTLS exigé. */
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  EMAIL_FROM: optionalString,
  SMS_PROVIDER: z.enum(["none", "http"]).default("none"),
  /** Passerelle SMS HTTP générique : POST JSON `{to, text, sender, reference}`. */
  SMS_HTTP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  SMS_HTTP_TOKEN: optionalString,
  SMS_SENDER_ID: z.preprocess(emptyToUndefined, z.string().max(11).optional()),
  /** Push mobile (FCM) : interface prête, aucun fournisseur implémenté. */
  PUSH_PROVIDER: z.enum(["none"]).default("none"),
  /** WhatsApp Business (API officielle) : interface prête, aucun fournisseur implémenté. */
  WHATSAPP_PROVIDER: z.enum(["none"]).default("none"),
  /** Passerelle Socket.IO `/realtime`. */
  REALTIME_ENABLED: z.enum(["true", "false"]).default("true"),
  /** Intervalle de contrôle de révocation des sessions des sockets ouvertes. */
  REALTIME_REVOCATION_CHECK_SECONDS: z.coerce
    .number()
    .int()
    .min(5)
    .max(3_600)
    .default(60),
  /** Événements entrants par socket et par minute. */
  REALTIME_EVENT_RATE_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(120),
  /** Rappel avant une visite confirmée ; 0 désactive les rappels. */
  APPOINTMENT_REMINDER_HOURS: z.coerce
    .number()
    .int()
    .min(0)
    .max(168)
    .default(24),
  /** Délai minimal entre la demande et l'horaire proposé. */
  APPOINTMENT_MIN_NOTICE_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_080)
    .default(60),
  APPOINTMENT_MAX_DAYS_AHEAD: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(90),
  APPOINTMENT_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  /** Collecte analytique (ingestion client et événements métier). */
  ANALYTICS_ENABLED: z.enum(["true", "false"]).default("true"),
  /** Version de la politique de confidentialité à laquelle se rapporte le consentement. */
  ANALYTICS_POLICY_VERSION: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,20}$/)
    .default("2026-10"),
  /** Lots d'événements par minute et par IP. */
  ANALYTICS_RATE_LIMIT: z.coerce.number().int().min(1).default(60),
  /** Âge maximal d'un événement client accepté (file hors ligne). */
  ANALYTICS_MAX_EVENT_AGE_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(720)
    .default(72),
  /** Conservation des événements bruts ; les agrégats restent. */
  ANALYTICS_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(7)
    .max(1_095)
    .default(395),
  /** Agrégation et purge périodiques dans l'API ; 0 les désactive. */
  ANALYTICS_WORKER_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_440)
    .default(15),
  /** Jours déjà agrégés recalculés à chaque passage (événements tardifs). */
  ANALYTICS_LATE_DAYS: z.coerce.number().int().min(0).max(7).default(3),
  /** Règle de lead qualifié : réponse côté annonce, visite, ou l'une des deux. */
  ANALYTICS_QUALIFIED_LEAD_RULE: z
    .enum(["REPLY", "APPOINTMENT", "REPLY_OR_APPOINTMENT"])
    .default("REPLY_OR_APPOINTMENT"),
  /** Fenêtre d'attribution d'un contact ou d'une visite à une recommandation. */
  ANALYTICS_ATTRIBUTION_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(720)
    .default(72),
  /** Taille minimale d'un groupe publié dans une ventilation administrateur. */
  ANALYTICS_MIN_GROUP_SIZE: z.coerce.number().int().min(1).max(100).default(5),
  /**
   * Clé AES-256 (64 hex) pour chiffrer les secrets webhook partenaires.
   * Absente : registre OK, livraisons outbound désactivées.
   */
  PARTNERS_SECRETS_KEY: optionalString,
  /** Intervalle du worker de livraison partenaire (0 = CLI / manuel seulement). */
  PARTNERS_WORKER_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(3_600)
    .default(30),
  /**
   * Prestataire de paiement. `none` : aucun paiement possible (commandes
   * refusées). `mock` : simulateur local, interdit en staging/production et
   * avec PAYMENT_ENVIRONMENT=live. Aucun prestataire réel n'est implémenté.
   */
  PAYMENT_PROVIDER: z.enum(["none", "mock"]).default("none"),
  /** Environnement du compte marchand ; enregistré sur chaque transaction. */
  PAYMENT_ENVIRONMENT: z.enum(["test", "live"]).default("test"),
  /** Secret HMAC des webhooks du simulateur (32 caractères minimum). */
  PAYMENT_MOCK_WEBHOOK_SECRET: optionalString,
  /** Tolérance d'horodatage des signatures de webhook. */
  PAYMENT_WEBHOOK_TOLERANCE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3_600)
    .default(300),
  /** Durée de validité d'une commande en attente de paiement. */
  BILLING_ORDER_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(10_080)
    .default(60),
  /** Tentatives de paiement par commande. */
  BILLING_MAX_ATTEMPTS_PER_ORDER: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5),
  /** Jours de grâce (PAST_DUE) après la fin de période avant expiration. */
  BILLING_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  /** Fenêtre avant l'échéance pendant laquelle un renouvellement est accepté. */
  BILLING_RENEWAL_WINDOW_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30),
  /** Rappel de renouvellement avant l'échéance ; 0 désactive les rappels. */
  BILLING_RENEWAL_REMINDER_DAYS: z.coerce
    .number()
    .int()
    .min(0)
    .max(30)
    .default(7),
  /** Réconciliation et échéances en processus ; 0 désactive la tâche. */
  BILLING_WORKER_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_440)
    .default(5),
  /** Requêtes par minute et par IP. */
  BILLING_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  BILLING_WEBHOOK_RATE_LIMIT: z.coerce.number().int().min(1).default(600),
  SWAGGER_ENABLED: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false"]).optional(),
  ),
  METRICS_ENABLED: z.enum(["true", "false"]).default("false"),
  /**
   * Jeton Bearer pour scraper Prometheus (`Authorization: Bearer …`).
   * Obligatoire dès que METRICS_ENABLED=true (min. 32 caractères).
   */
  METRICS_SCRAPE_TOKEN: z.string().default(""),
  /** Purge des artefacts Identity expirés (sessions, OTP, reset) ; 0 = CLI only. */
  IDENTITY_RETENTION_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_080)
    .default(0),
  /** Conservation des sessions révoquées / expirées avant suppression (jours). */
  IDENTITY_SESSION_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30),
  /** Annonces créées dans la fenêtre avant alerte ACCOUNT_BURST_ACTIVITY. */
  TRUST_LISTING_BURST_THRESHOLD: z.coerce
    .number()
    .int()
    .min(2)
    .max(100)
    .default(8),
  /** Fenêtre (heures) pour ACCOUNT_BURST_ACTIVITY. */
  TRUST_LISTING_BURST_WINDOW_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(24),
  OTEL_ENABLED: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default(""),
  S3_ACCESS_KEY: z.string().default(""),
  S3_SECRET_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  /** Assistant conversationnel : activé par défaut (extraction rules, Search réel). */
  AI_ASSISTANT_ENABLED: z.enum(["true", "false"]).default("true"),
  /** `rules` (défaut) ou `openai` (reformulation texte uniquement si clé présente). */
  AI_ASSISTANT_PROVIDER: z.enum(["rules", "openai"]).default("rules"),
  AI_ASSISTANT_OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_ASSISTANT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60_000)
    .default(8000),
  AI_ASSISTANT_MAX_TOKENS: z.coerce
    .number()
    .int()
    .min(50)
    .max(2000)
    .default(400),
  AI_ASSISTANT_MAX_MESSAGE_LENGTH: z.coerce
    .number()
    .int()
    .min(100)
    .max(10_000)
    .default(2000),
  AI_ASSISTANT_MAX_HISTORY_TURNS: z.coerce
    .number()
    .int()
    .min(2)
    .max(40)
    .default(12),
  AI_ASSISTANT_CONVERSATION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(24),
  AI_ASSISTANT_SEARCH_LIMIT: z.coerce.number().int().min(1).max(50).default(12),
  AI_ASSISTANT_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  SENTRY_DSN: z.string().default(""),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>

const DURATION_PATTERN = /^\d+(ms|s|m|h|d)$/

/** Convertit une durée `15m`, `30d`, `60s`, `500ms` en millisecondes. */
export function parseDuration(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim())
  if (!match) throw new Error(`Durée invalide: ${value}`)
  const amount = Number.parseInt(value, 10)
  const unit = match[1] as "ms" | "s" | "m" | "h" | "d"
  const factor = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    unit
  ]
  return amount * factor
}

const durationKeys = [
  "JWT_ACCESS_TTL",
  "JWT_REFRESH_TTL",
  "PASSWORD_RESET_TTL",
  "OTP_TTL",
] as const

export function parseApiEnv(input: Record<string, unknown>): ApiEnv {
  const result = apiEnvSchema
    .superRefine((env, ctx) => {
      for (const key of durationKeys) {
        if (!DURATION_PATTERN.test(env[key])) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "durée invalide",
          })
        }
      }
      if (env.AUTH_DEV_PRINT_CODES === "true" && env.APP_ENV !== "local") {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_DEV_PRINT_CODES"],
          message: "réservé à APP_ENV=local",
        })
      }
      if (
        env.METRICS_ENABLED === "true" &&
        env.METRICS_SCRAPE_TOKEN.trim().length < 32
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["METRICS_SCRAPE_TOKEN"],
          message: "requis (≥ 32 caractères) lorsque METRICS_ENABLED=true",
        })
      }
      if (env.SEARCH_ENGINE === "opensearch" && !env.OPENSEARCH_NODE) {
        ctx.addIssue({
          code: "custom",
          path: ["OPENSEARCH_NODE"],
          message: "requis avec SEARCH_ENGINE=opensearch",
        })
      }
      if (env.SEARCH_DEFAULT_LIMIT > env.SEARCH_MAX_LIMIT) {
        ctx.addIssue({
          code: "custom",
          path: ["SEARCH_DEFAULT_LIMIT"],
          message: "supérieur à SEARCH_MAX_LIMIT",
        })
      }
      if (
        env.RECOMMENDATION_ENGINE === "remote" &&
        !env.RECOMMENDATION_SERVICE_URL
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["RECOMMENDATION_SERVICE_URL"],
          message: "requis avec RECOMMENDATION_ENGINE=remote",
        })
      }
      if (env.RECOMMENDATION_DEFAULT_LIMIT > env.RECOMMENDATION_MAX_LIMIT) {
        ctx.addIssue({
          code: "custom",
          path: ["RECOMMENDATION_DEFAULT_LIMIT"],
          message: "supérieur à RECOMMENDATION_MAX_LIMIT",
        })
      }
      if (env.MEDIA_STORAGE_PROVIDER === "local") {
        if (env.APP_ENV === "production" || env.APP_ENV === "staging") {
          ctx.addIssue({
            code: "custom",
            path: ["MEDIA_STORAGE_PROVIDER"],
            message: "stockage local interdit hors développement",
          })
        }
      } else {
        for (const key of [
          "S3_BUCKET",
          "S3_ACCESS_KEY",
          "S3_SECRET_KEY",
        ] as const) {
          if (!env[key]) {
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: `requis avec MEDIA_STORAGE_PROVIDER=${env.MEDIA_STORAGE_PROVIDER}`,
            })
          }
        }
        if (env.MEDIA_STORAGE_PROVIDER === "r2" && !env.S3_ENDPOINT) {
          ctx.addIssue({
            code: "custom",
            path: ["S3_ENDPOINT"],
            message: "requis avec MEDIA_STORAGE_PROVIDER=r2",
          })
        }
      }
      if (env.S3_PUBLIC_BUCKET && !env.MEDIA_PUBLIC_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_PUBLIC_BASE_URL"],
          message: "requis avec S3_PUBLIC_BUCKET",
        })
      }
      if (env.S3_PUBLIC_BUCKET && env.S3_PUBLIC_BUCKET === env.S3_BUCKET) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_PUBLIC_BUCKET"],
          message: "doit différer du bucket privé S3_BUCKET",
        })
      }
      if (env.EMAIL_PROVIDER === "smtp") {
        for (const key of ["SMTP_HOST", "EMAIL_FROM"] as const) {
          if (!env[key]) {
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: "requis avec EMAIL_PROVIDER=smtp",
            })
          }
        }
      }
      if (env.SMS_PROVIDER === "http") {
        if (!env.SMS_HTTP_URL) {
          ctx.addIssue({
            code: "custom",
            path: ["SMS_HTTP_URL"],
            message: "requis avec SMS_PROVIDER=http",
          })
        } else if (
          !env.SMS_HTTP_URL.startsWith("https://") &&
          (env.APP_ENV === "production" || env.APP_ENV === "staging")
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["SMS_HTTP_URL"],
            message: "HTTPS exigé hors développement",
          })
        }
      }
      if (env.PAYMENT_PROVIDER === "mock") {
        if (
          env.APP_ENV === "production" ||
          env.APP_ENV === "staging" ||
          env.NODE_ENV === "production" ||
          env.PAYMENT_ENVIRONMENT === "live"
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["PAYMENT_PROVIDER"],
            message: "simulateur interdit hors développement et en live",
          })
        }
        if (
          !env.PAYMENT_MOCK_WEBHOOK_SECRET ||
          env.PAYMENT_MOCK_WEBHOOK_SECRET.length < 32
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["PAYMENT_MOCK_WEBHOOK_SECRET"],
            message:
              "requis (32 caractères minimum) avec PAYMENT_PROVIDER=mock",
          })
        }
      }
      try {
        parseRecommendationWeights(env.RECOMMENDATION_WEIGHTS)
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["RECOMMENDATION_WEIGHTS"],
          message: "poids invalides (7 dimensions, somme 100)",
        })
      }
    })
    .safeParse(input)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.code}`)
      .join("; ")
    throw new Error(`Configuration d'environnement invalide: ${message}`)
  }
  return result.data
}

export function isSwaggerEnabled(env: {
  APP_ENV: string
  SWAGGER_ENABLED?: string
}): boolean {
  if (env.SWAGGER_ENABLED === "true") return true
  if (env.SWAGGER_ENABLED === "false") return false
  return env.APP_ENV === "local" || env.APP_ENV === "development"
}

export function parseCorsOrigins(
  value: string,
  ...extra: Array<string | undefined>
): string[] {
  const origins = [...value.split(","), ...extra]
    .map((origin) => origin?.trim() ?? "")
    .filter((origin) => origin.length > 0 && origin !== "*")
    .map((origin) => origin.replace(/\/+$/, ""))
  return [...new Set(origins)]
}
