/**
 * Catalogue central des indicateurs BI (Prompt 21).
 * Une seule définition par métrique — les UIs ne recalculent pas les formules.
 */

export type MetricFreshness = "live" | "daily_aggregate" | "on_demand_snapshot"

export type MetricRole = "analytics:admin" | "analytics:read" | "billing:read"

export interface MetricDefinition {
  id: string
  name: string
  description: string
  formula: string
  sources: string[]
  freshness: MetricFreshness
  roles: MetricRole[]
  filters: string[]
  limitations: string
}

export const METRICS_CATALOG: readonly MetricDefinition[] = [
  {
    id: "kpi.registrations",
    name: "Inscriptions",
    description: "Comptes créés sur la période (flux).",
    formula: "COUNT(users) WHERE created_at IN range",
    sources: ["users", "analytics_daily_metrics.kpi.registrations"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Ne mesure pas les visiteurs anonymes.",
  },
  {
    id: "kpi.listings_published",
    name: "Annonces publiées",
    description: "Passages au statut PUBLISHED sur la période.",
    formula: "COUNT(listing_status_history → PUBLISHED) IN range",
    sources: ["listing_status_history", "analytics_daily_metrics"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Distinct du stock d’annonces actives à l’instant T.",
  },
  {
    id: "kpi.contacts",
    name: "Prises de contact",
    description: "Conversations / demandes de contact créées.",
    formula: "COUNT(contacts métier) IN range",
    sources: [
      "conversations/inquiries",
      "analytics_daily_metrics.kpi.contacts",
    ],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Pas une vente ou location conclue.",
  },
  {
    id: "kpi.appointments_requested",
    name: "Visites demandées",
    description: "Rendez-vous créés sur la période.",
    formula: "COUNT(appointments) IN range",
    sources: ["appointments", "analytics_daily_metrics"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Demande ≠ visite réalisée.",
  },
  {
    id: "kpi.qualified_leads",
    name: "Contacts qualifiés",
    description: "Selon ANALYTICS_QUALIFIED_LEAD_RULE (réponse et/ou RDV).",
    formula: "Règle configurée sur événements / tables métier",
    sources: ["analytics_daily_metrics.kpi.qualified_leads"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Dépend de la règle et de la complétude des réponses.",
  },
  {
    id: "search.zero_result_rate",
    name: "Taux de recherches sans résultat",
    description: "Part des recherches soumises sans annonce.",
    formula: "zero_results / submitted",
    sources: ["analytics_daily_metrics.search.*"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Mesure la plateforme, pas tout le marché ivoirien.",
  },
  {
    id: "funnel.actor_day",
    name: "Entonnoir (acteur-jour)",
    description:
      "Étapes 1_VISIT … 8_QUALIFIED_LEAD pour visiteurs consentants.",
    formula: "Actors distincts par étape et par jour, sommés sur la période",
    sources: ["analytics_daily_metrics.funnel"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "Cohorte CONSENT uniquement ; somme multi-jours ≠ utilisateurs uniques.",
  },
  {
    id: "reco.click_through_rate",
    name: "CTR recommandations",
    description: "Ouvertures / impressions réellement affichées.",
    formula: "reco.opens / reco.impressions",
    sources: ["analytics_daily_metrics.reco.*"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to", "algorithmVersion"],
    limitations: "Nécessite événements client d’exposition.",
  },
  {
    id: "market.active_listings",
    name: "Annonces actives (stock)",
    description: "Annonces PUBLISHED non expirées, bien ACTIVE.",
    formula: "COUNT(listings) éligibles maintenant",
    sources: ["listings", "properties", "listing_prices"],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["listingType", "commune"],
    limitations: "Instantané ; pas un flux historique.",
  },
  {
    id: "market.price_median",
    name: "Prix médian observé",
    description: "Médiane des prix courants par type d’offre et périodicité.",
    formula: "percentile_cont(0.5) sur listing_prices.valid_to IS NULL",
    sources: ["listing_prices"],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["listingType", "period", "commune"],
    limitations:
      "Prix d’annonce ≠ prix de transaction réelle. Groupes < minGroupSize masqués.",
  },
  {
    id: "listing.contact_rate",
    name: "Taux contact / consultation",
    description: "Contacts soumis / vues détail (annonce gérée).",
    formula: "contactsSubmitted / detailViews",
    sources: ["analytics_listing_daily"],
    freshness: "daily_aggregate",
    roles: ["analytics:read", "analytics:admin"],
    filters: ["from", "to", "listingId"],
    limitations:
      "Dénominateur dépend des vues client consenties ; IDs web legacy ≠ listing Nest.",
  },
  {
    id: "billing.gross_collected",
    name: "Encaissé brut plateforme",
    description: "Somme des paiements SUCCEEDED (services Mon Appart).",
    formula: "SUM(payment_transactions) status SUCCEEDED",
    sources: ["billing admin summary"],
    freshness: "live",
    roles: ["billing:read"],
    filters: ["currency", "environment"],
    limitations: "Pas un revenu net ; distinct des loyers/prix de biens.",
  },
  {
    id: "growth.acquisition_by_channel",
    name: "Touches d’acquisition par canal",
    description:
      "Événements acquisition_touch (FIRST/SESSION) ventilés par channel.",
    formula: "COUNT(acquisition_touch) GROUP BY channel",
    sources: ["analytics_events.acquisition_touch"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to", "channel", "touchKind"],
    limitations:
      "Consentement requis. Association ≠ causalité. Pas de dépenses pub importées.",
  },
  {
    id: "growth.activated_seeker",
    name: "Chercheurs activés",
    description:
      "Utilisateurs/acteurs ayant fait recherche ou vue détail dans les 7 j suivant inscription ou 1ʳᵉ visite.",
    formula:
      "Acteurs avec search_submitted OU listing_detail_viewed dans fenêtre",
    sources: ["analytics_events", "analytics_daily_metrics.funnel"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "Nécessite tracker client branché + consentement. Distinct de l’activation annonceur.",
  },
  {
    id: "growth.activated_publisher",
    name: "Annonceurs activés",
    description: "Comptes OWNER/AGENCY avec au moins une annonce publiée.",
    formula: "COUNT publishers WITH ≥1 listing_published",
    sources: ["listings", "kpi.listings_published", "users"],
    freshness: "daily_aggregate",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations: "Volume ≠ qualité ; préférer annonces complètes et éligibles.",
  },
  {
    id: "retention.saved_search_resume_rate",
    name: "Reprise des recherches enregistrées",
    description: "Part des recherches persistantes relancées sur la période.",
    formula:
      "COUNT(search_resumed) / COUNT(saved_search_created ∪ saved_search_updated)",
    sources: [
      "analytics_events.search_resumed",
      "analytics_events.saved_search_*",
    ],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "Dénominateur = recherches touchées, pas tous les comptes. Pas un taux de location.",
  },
  {
    id: "retention.alert_click_rate",
    name: "Clics sur alertes immobilières",
    description: "Clics / alertes envoyées (digest exact, hors near_budget).",
    formula: "COUNT(property_alert_clicked) / COUNT(property_alert_sent)",
    sources: [
      "analytics_events.property_alert_sent",
      "analytics_events.property_alert_clicked",
    ],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "property_alert_clicked n’est pas encore instrumenté côté client. Ne pas inventer un CTR.",
  },
  {
    id: "retention.post_visit_feedback_rate",
    name: "Retours post-visite",
    description: "Retours facultatifs / visites COMPLETED.",
    formula:
      "COUNT(post_visit_feedback_submitted) / COUNT(appointments COMPLETED)",
    sources: ["analytics_events.post_visit_feedback_submitted", "appointments"],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "Le non-retour n’est pas un échec. Issues déclarées ≠ résultats vérifiés.",
  },
  {
    id: "retention.reactivation_return_rate",
    name: "Retour après réactivation",
    description: "Retours déclarés / digest de réactivation envoyés.",
    formula: "COUNT(reactivation_returned) / COUNT(reactivation_sent)",
    sources: [
      "analytics_events.reactivation_sent",
      "analytics_events.reactivation_returned",
    ],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "reactivation_returned n’est pas instrumenté. Association ≠ causalité. Groupe témoin requis avant conclusion.",
  },
  {
    id: "retention.marketing_unsubscribe_rate",
    name: "Désinscription marketing",
    description:
      "Comptes ayant coupé au moins un canal MARKETING / campagnes envoyées.",
    formula:
      "COUNT(marketing_unsubscribed) / utilisateurs exposés aux comm. promo",
    sources: ["analytics_events.marketing_unsubscribed"],
    freshness: "on_demand_snapshot",
    roles: ["analytics:admin"],
    filters: ["from", "to"],
    limitations:
      "Distinct des alertes transactionnelles. Le marketing est opt-in (défaut off).",
  },
] as const

export function getMetric(id: string): MetricDefinition | undefined {
  return METRICS_CATALOG.find((metric) => metric.id === id)
}
