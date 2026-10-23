import { Injectable, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client"

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry()
  readonly httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Durée des requêtes HTTP",
    labelNames: ["method", "route", "status"],
    registers: [this.registry],
  })
  readonly auth = {
    loginSuccess: new Counter({
      name: "auth_login_success_total",
      help: "Connexions réussies",
      registers: [this.registry],
    }),
    loginFailure: new Counter({
      name: "auth_login_failure_total",
      help: "Connexions refusées",
      labelNames: ["reason"],
      registers: [this.registry],
    }),
    refresh: new Counter({
      name: "auth_refresh_total",
      help: "Rotations de refresh token",
      labelNames: ["outcome"],
      registers: [this.registry],
    }),
    refreshReuse: new Counter({
      name: "auth_refresh_reuse_detected_total",
      help: "Réutilisations de refresh token détectées",
      registers: [this.registry],
    }),
    otpSent: new Counter({
      name: "auth_otp_sent_total",
      help: "Codes OTP envoyés",
      labelNames: ["channel"],
      registers: [this.registry],
    }),
    otpFailure: new Counter({
      name: "auth_otp_failure_total",
      help: "Vérifications OTP refusées",
      labelNames: ["reason"],
      registers: [this.registry],
    }),
    passwordResetRequested: new Counter({
      name: "auth_password_reset_requested_total",
      help: "Demandes de réinitialisation acceptées",
      registers: [this.registry],
    }),
  }

  readonly catalog = {
    propertyCreated: new Counter({
      name: "property_created_total",
      help: "Biens créés",
      registers: [this.registry],
    }),
    propertyDeleted: new Counter({
      name: "property_deleted_total",
      help: "Biens supprimés (suppression logique)",
      registers: [this.registry],
    }),
    listingCreated: new Counter({
      name: "listing_created_total",
      help: "Annonces créées",
      labelNames: ["listing_type"],
      registers: [this.registry],
    }),
    listingStatusChanged: new Counter({
      name: "listing_status_changed_total",
      help: "Changements de statut d'annonce",
      labelNames: ["to"],
      registers: [this.registry],
    }),
    listingPriceChanged: new Counter({
      name: "listing_price_changed_total",
      help: "Changements de prix d'annonce",
      registers: [this.registry],
    }),
  }

  readonly search = {
    requests: new Counter({
      name: "search_requests_total",
      help: "Recherches et suggestions servies",
      labelNames: ["kind", "engine"],
      registers: [this.registry],
    }),
    errors: new Counter({
      name: "search_errors_total",
      help: "Recherches en erreur (hors erreurs de validation)",
      labelNames: ["kind", "code"],
      registers: [this.registry],
    }),
    latency: new Histogram({
      name: "search_latency_ms",
      help: "Durée des recherches en millisecondes",
      labelNames: ["kind", "engine"],
      buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200],
      registers: [this.registry],
    }),
    zeroResults: new Counter({
      name: "search_zero_results_total",
      help: "Recherches sans résultat",
      registers: [this.registry],
    }),
    cacheHits: new Counter({
      name: "search_cache_hits_total",
      help: "Recherches servies depuis le cache",
      registers: [this.registry],
    }),
    cacheMisses: new Counter({
      name: "search_cache_misses_total",
      help: "Recherches cacheables absentes du cache",
      registers: [this.registry],
    }),
    opensearchErrors: new Counter({
      name: "search_opensearch_errors_total",
      help: "Erreurs OpenSearch (recherche ou indexation)",
      labelNames: ["operation"],
      registers: [this.registry],
    }),
    fallbacks: new Counter({
      name: "search_fallback_total",
      help: "Recherches servies par PostgreSQL après un échec d'OpenSearch",
      registers: [this.registry],
    }),
    indexing: new Counter({
      name: "search_indexing_total",
      help: "Documents de recherche indexés ou supprimés",
      labelNames: ["target", "operation"],
      registers: [this.registry],
    }),
    indexingFailures: new Counter({
      name: "search_indexing_failures_total",
      help: "Échecs d'indexation",
      labelNames: ["target"],
      registers: [this.registry],
    }),
  }

  readonly recommendation = {
    requests: new Counter({
      name: "recommendation_requests_total",
      help: "Listes de recommandations servies",
      labelNames: ["context", "level", "cache"],
      registers: [this.registry],
    }),
    latency: new Histogram({
      name: "recommendation_latency_ms",
      help: "Durée de calcul ou de lecture d'une liste, en millisecondes",
      labelNames: ["context", "cache"],
      buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200],
      registers: [this.registry],
    }),
    candidates: new Histogram({
      name: "recommendation_candidates",
      help: "Taille du pool de candidats",
      labelNames: ["context"],
      buckets: [0, 10, 25, 50, 100, 200, 400, 800, 1600],
      registers: [this.registry],
    }),
    empty: new Counter({
      name: "recommendation_empty_total",
      help: "Listes vides (premières pages)",
      labelNames: ["context"],
      registers: [this.registry],
    }),
    fallbacks: new Counter({
      name: "recommendation_fallback_total",
      help: "Classements servis par le moteur à règles après un échec du moteur distant",
      labelNames: ["reason"],
      registers: [this.registry],
    }),
    errors: new Counter({
      name: "recommendation_errors_total",
      help: "Recommandations en erreur (hors validation)",
      labelNames: ["code"],
      registers: [this.registry],
    }),
    feedback: new Counter({
      name: "recommendation_feedback_total",
      help: "Retours sur recommandations (nouveaux uniquement)",
      labelNames: ["type"],
      registers: [this.registry],
    }),
    profileRebuilds: new Counter({
      name: "recommendation_profile_rebuilds_total",
      help: "Profils comportementaux recalculés",
      labelNames: ["outcome"],
      registers: [this.registry],
    }),
    shadow: new Counter({
      name: "recommendation_shadow_total",
      help: "Comparaisons shadow du moteur distant (sans exposition)",
      labelNames: ["outcome"],
      registers: [this.registry],
    }),
  }

  readonly assistant = {
    requests: new Counter({
      name: "assistant_requests_total",
      help: "Tours assistant servis",
      labelNames: ["mode", "provider"],
      registers: [this.registry],
    }),
    latency: new Histogram({
      name: "assistant_latency_ms",
      help: "Durée d'un tour assistant, en millisecondes",
      labelNames: ["mode"],
      buckets: [10, 25, 50, 100, 200, 400, 800, 1600, 3200, 8000],
      registers: [this.registry],
    }),
    empty: new Counter({
      name: "assistant_empty_total",
      help: "Tours Search sans annonce",
      registers: [this.registry],
    }),
    fallbacks: new Counter({
      name: "assistant_fallback_total",
      help: "Replis (Search en erreur ou OpenAI indisponible)",
      labelNames: ["reason"],
      registers: [this.registry],
    }),
    injection: new Counter({
      name: "assistant_injection_suspected_total",
      help: "Messages ressemblant à une injection de prompt (non bloqués)",
      registers: [this.registry],
    }),
    feedback: new Counter({
      name: "assistant_feedback_total",
      help: "Retours utilisateur sur l'assistant",
      labelNames: ["rating"],
      registers: [this.registry],
    }),
  }

  readonly media = {
    uploadsStarted: new Counter({
      name: "media_upload_sessions_total",
      help: "Sessions d'envoi ouvertes",
      labelNames: ["type"],
      registers: [this.registry],
    }),
    uploadsCompleted: new Counter({
      name: "media_uploads_completed_total",
      help: "Envois confirmés après vérification du stockage",
      labelNames: ["type"],
      registers: [this.registry],
    }),
    rejected: new Counter({
      name: "media_rejected_total",
      help: "Fichiers refusés (contenu, taille, analyse)",
      labelNames: ["type", "reason"],
      registers: [this.registry],
    }),
    processed: new Counter({
      name: "media_processing_total",
      help: "Traitements terminés",
      labelNames: ["type", "outcome"],
      registers: [this.registry],
    }),
    processingDuration: new Histogram({
      name: "media_processing_duration_ms",
      help: "Durée d'un traitement de média, en millisecondes",
      labelNames: ["type"],
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000],
      registers: [this.registry],
    }),
    uploadBytes: new Histogram({
      name: "media_upload_bytes",
      help: "Taille des fichiers reçus",
      labelNames: ["type"],
      buckets: [
        100_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
        25_000_000, 50_000_000, 100_000_000, 200_000_000,
      ],
      registers: [this.registry],
    }),
    pendingJobs: new Gauge({
      name: "media_jobs_pending",
      help: "Médias en attente de traitement (dernier relevé du worker)",
      registers: [this.registry],
    }),
    storageErrors: new Counter({
      name: "media_storage_errors_total",
      help: "Erreurs du fournisseur de stockage",
      labelNames: ["operation"],
      registers: [this.registry],
    }),
    purged: new Counter({
      name: "media_purged_total",
      help: "Médias dont les objets ont été supprimés définitivement",
      registers: [this.registry],
    }),
    orphans: new Gauge({
      name: "media_orphan_objects",
      help: "Objets sans média correspondant (dernière analyse)",
      registers: [this.registry],
    }),
  }

  readonly communication = {
    messagesSent: new Counter({
      name: "messages_sent_total",
      help: "Messages enregistrés",
      labelNames: ["type"],
      registers: [this.registry],
    }),
    messagesRejected: new Counter({
      name: "messages_rejected_total",
      help: "Messages refusés (limite, répétition, validation)",
      labelNames: ["reason"],
      registers: [this.registry],
    }),
    persistLatency: new Histogram({
      name: "message_persist_latency_ms",
      help: "Durée d'enregistrement d'un message, en millisecondes",
      buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600],
      registers: [this.registry],
    }),
    conversationsCreated: new Counter({
      name: "conversations_created_total",
      help: "Conversations ouvertes",
      labelNames: ["type"],
      registers: [this.registry],
    }),
    socketConnections: new Gauge({
      name: "realtime_connections",
      help: "Sockets temps réel ouvertes sur cette instance",
      registers: [this.registry],
    }),
    socketRejected: new Counter({
      name: "realtime_connections_rejected_total",
      help: "Connexions temps réel refusées",
      labelNames: ["reason"],
      registers: [this.registry],
    }),
    eventsEmitted: new Counter({
      name: "realtime_events_emitted_total",
      help: "Événements temps réel diffusés",
      labelNames: ["event"],
      registers: [this.registry],
    }),
    notificationsCreated: new Counter({
      name: "notifications_created_total",
      help: "Notifications créées (hors doublons)",
      labelNames: ["category"],
      registers: [this.registry],
    }),
    deliveries: new Counter({
      name: "notification_deliveries_total",
      help: "Livraisons terminées, par canal et issue",
      labelNames: ["channel", "outcome"],
      registers: [this.registry],
    }),
    deliveryRetries: new Counter({
      name: "notification_delivery_retries_total",
      help: "Nouvelles tentatives planifiées",
      labelNames: ["channel", "reason"],
      registers: [this.registry],
    }),
    deliveryLatency: new Histogram({
      name: "notification_delivery_latency_ms",
      help: "Délai entre la création de la notification et l'envoi accepté",
      labelNames: ["channel"],
      buckets: [100, 500, 1000, 5000, 15000, 60000, 300000, 900000, 3600000],
      registers: [this.registry],
    }),
    pendingDeliveries: new Gauge({
      name: "notification_deliveries_pending",
      help: "Livraisons en file (dernier relevé du worker)",
      registers: [this.registry],
    }),
  }

  /** Labels bornés : source, issue, motif, tâche. Jamais d'identifiant ni de propriété. */
  readonly analytics = {
    events: new Counter({
      name: "analytics_events_total",
      help: "Événements analytiques reçus, par source et issue",
      labelNames: ["source", "outcome"],
      registers: [this.registry],
    }),
    rejected: new Counter({
      name: "analytics_events_rejected_total",
      help: "Événements refusés ou ignorés, par motif",
      labelNames: ["source", "reason"],
      registers: [this.registry],
    }),
    batchLatency: new Histogram({
      name: "analytics_ingest_latency_ms",
      help: "Durée de traitement d'un lot, en millisecondes",
      buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600],
      registers: [this.registry],
    }),
    trackingFailures: new Counter({
      name: "analytics_tracking_failures_total",
      help: "Événements métier non enregistrés (erreur sans impact sur l'action)",
      registers: [this.registry],
    }),
    jobRuns: new Counter({
      name: "analytics_job_runs_total",
      help: "Exécutions des tâches d'agrégation et de purge",
      labelNames: ["job", "outcome"],
      registers: [this.registry],
    }),
    jobDuration: new Histogram({
      name: "analytics_job_duration_ms",
      help: "Durée des tâches analytiques, en millisecondes",
      labelNames: ["job"],
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 15000, 60000, 300000],
      registers: [this.registry],
    }),
    lastSuccess: new Gauge({
      name: "analytics_job_last_success_seconds",
      help: "Horodatage Unix du dernier succès de chaque tâche",
      labelNames: ["job"],
      registers: [this.registry],
    }),
    purged: new Counter({
      name: "analytics_events_purged_total",
      help: "Événements bruts supprimés à l'expiration de la rétention",
      registers: [this.registry],
    }),
  }

  /**
   * Labels bornés : prestataire (code technique), statut, issue, motif.
   * Jamais d'identifiant, de référence, de montant ni de donnée personnelle.
   */
  readonly billing = {
    ordersCreated: new Counter({
      name: "billing_orders_created_total",
      help: "Commandes créées",
      labelNames: ["kind"],
      registers: [this.registry],
    }),
    paymentAttempts: new Counter({
      name: "billing_payment_attempts_total",
      help: "Tentatives de paiement ouvertes auprès d'un prestataire",
      labelNames: ["provider", "outcome"],
      registers: [this.registry],
    }),
    paymentResults: new Counter({
      name: "billing_payment_results_total",
      help: "Statuts finaux de paiement appliqués",
      labelNames: ["provider", "status"],
      registers: [this.registry],
    }),
    webhooks: new Counter({
      name: "billing_webhooks_total",
      help: "Notifications de prestataire reçues, par issue",
      labelNames: ["provider", "outcome"],
      registers: [this.registry],
    }),
    providerErrors: new Counter({
      name: "billing_provider_errors_total",
      help: "Erreurs d'appel au prestataire",
      labelNames: ["provider", "operation"],
      registers: [this.registry],
    }),
    incidents: new Counter({
      name: "billing_incidents_total",
      help: "Incidents de facturation ouverts",
      labelNames: ["kind"],
      registers: [this.registry],
    }),
    refunds: new Counter({
      name: "billing_refunds_total",
      help: "Remboursements par statut atteint",
      labelNames: ["status"],
      registers: [this.registry],
    }),
    subscriptionChanges: new Counter({
      name: "billing_subscription_changes_total",
      help: "Changements d'état d'abonnement",
      labelNames: ["change"],
      registers: [this.registry],
    }),
    quotaRejections: new Counter({
      name: "billing_listing_quota_rejections_total",
      help: "Publications refusées pour quota d'annonces atteint",
      registers: [this.registry],
    }),
    jobRuns: new Counter({
      name: "billing_job_runs_total",
      help: "Passages de la réconciliation",
      labelNames: ["outcome"],
      registers: [this.registry],
    }),
  }

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (!this.isEnabled()) return
    collectDefaultMetrics({ register: this.registry })
  }

  isEnabled(): boolean {
    return this.config.get<string>("METRICS_ENABLED") === "true"
  }
}
