/**
 * Inventaire des systèmes « intelligents » réellement présents dans le dépôt.
 * Un prototype documenté n’est pas opérationnel. Classification interne —
 * ce n’est pas une certification juridique.
 */

export type AiRiskLevel = "low" | "moderate" | "high" | "critical"

export type AiSystemKind =
  | "deterministic_rules"
  | "deterministic_nlu"
  | "optional_llm"
  | "remote_optional"
  | "not_implemented"

export type AiAutomationLevel =
  "suggestion" | "ranking" | "assisted_moderation" | "none"

export type AiOperationalStatus =
  "operational" | "optional_disabled" | "stub" | "documented_only"

export interface AiSystemRecord {
  id: string
  name: string
  purpose: string
  technicalOwner: string
  productOwner: string
  kind: AiSystemKind
  status: AiOperationalStatus
  automation: AiAutomationLevel
  risk: AiRiskLevel
  inputs: string[]
  outputs: string[]
  audiences: string[]
  externalDependencies: string[]
  qualityMetrics: string[]
  controls: string[]
  disableConditions: string[]
  configOrModelVersion: string
  risks: string[]
}

/**
 * Source de vérité de l’inventaire. Les versions runtime (flags, moteur,
 * prompt) sont fusionnées par le service de gouvernance.
 */
export const AI_SYSTEM_REGISTRY: readonly AiSystemRecord[] = [
  {
    id: "search_intelligent",
    name: "Recherche immobilière",
    purpose:
      "Filtrer et trier le catalogue publié selon des critères explicites.",
    technicalOwner: "SearchModule",
    productOwner: "Découverte",
    kind: "deterministic_rules",
    status: "operational",
    automation: "ranking",
    risk: "low",
    inputs: [
      "filtres Search (type, lieu, budget, surface)",
      "texte q normalisé",
    ],
    outputs: ["annonces publiées paginées", "facettes"],
    audiences: ["visiteurs", "comptes connectés"],
    externalDependencies: ["PostgreSQL", "OpenSearch optionnel"],
    qualityMetrics: ["search.zero_result_rate", "latence search_*"],
    controls: [
      "visibles = PUBLISHED uniquement",
      "FF SEARCH_ENGINE",
      "repli PostgreSQL",
    ],
    disableConditions: ["panne Search → pages vides, pas de données fictives"],
    configOrModelVersion: "search-postgres | search-opensearch",
    risks: ["zéro résultat mal expliqué", "biais de couverture du catalogue"],
  },
  {
    id: "recommendation",
    name: "Recommandation immobilière",
    purpose:
      "Proposer des annonces classées (personnalisé, similaires) avec raisons.",
    technicalOwner: "RecommendationModule",
    productOwner: "Découverte",
    kind: "deterministic_rules",
    status: "operational",
    automation: "ranking",
    risk: "moderate",
    inputs: [
      "préférences déclarées",
      "signaux de comportement agrégés",
      "candidats Search",
    ],
    outputs: [
      "liste classée + score + reasons",
      "Recommendation persistée (upsert)",
      "événements reco.*",
    ],
    audiences: ["utilisateurs web", "API publique"],
    externalDependencies: [
      "PostgreSQL",
      "Redis cache",
      "FastAPI optionnel (stub /health)",
    ],
    qualityMetrics: [
      "Precision@K / NDCG@K hors ligne (fixtures synthétiques)",
      "recommendation_empty_total",
      "reco.click_through_rate (si exposition client)",
    ],
    controls: [
      "RECOMMENDATION_ENGINE=rules|remote",
      "RECOMMENDATION_SHADOW",
      "FF_WEB_RECOMMENDATIONS",
      "repli rules-v1",
    ],
    disableConditions: [
      "FF_WEB_RECOMMENDATIONS=false (UI)",
      "RECOMMENDATION_ENGINE=rules (rollback moteur)",
    ],
    configOrModelVersion: "rules-v1",
    risks: [
      "boucle de popularité",
      "sous-représentation des nouvelles agences",
      "annonces sponsorisées absentes — pas de mélange pub/organic aujourd’hui",
    ],
  },
  {
    id: "assistant",
    name: "Assistant conversationnel",
    purpose:
      "Extraire des critères immobiliers et lancer Search ; reformuler une réponse.",
    technicalOwner: "AiAssistantModule",
    productOwner: "Découverte",
    kind: "deterministic_nlu",
    status: "operational",
    automation: "suggestion",
    risk: "moderate",
    inputs: ["message utilisateur", "historique de session mémoire"],
    outputs: [
      "critères structurés",
      "cartes Search",
      "message (rules ou OpenAI sanitizé)",
    ],
    audiences: ["visiteurs", "comptes connectés"],
    externalDependencies: ["SearchModule", "OpenAI optionnel"],
    qualityMetrics: [
      "extraction critères (jeu golden)",
      "assistant_empty_total",
      "assistant_fallback_total",
    ],
    controls: [
      "NLU déterministe = source de vérité",
      "LLM = reformulation seulement",
      "sanitize UUID",
      "AI_ASSISTANT_ENABLED",
      "FF_WEB_ASSISTANT",
      "rate limit",
    ],
    disableConditions: [
      "AI_ASSISTANT_ENABLED=false",
      "AI_ASSISTANT_PROVIDER=rules",
      "FF_WEB_ASSISTANT=false",
    ],
    configOrModelVersion: "assistant-reply-v1",
    risks: [
      "hallucination si OpenAI mal sanitizé",
      "injection de prompt dans le message",
      "store mémoire non partagé multi-instance",
    ],
  },
  {
    id: "lead_priority",
    name: "Priorisation des leads",
    purpose: "Ordonner les demandes de contact pour les professionnels.",
    technicalOwner: "TransactionModule / inquiry-priority",
    productOwner: "Leads",
    kind: "deterministic_rules",
    status: "operational",
    automation: "ranking",
    risk: "moderate",
    inputs: ["métadonnées de demande", "délais de réponse"],
    outputs: ["score / priorité déclarative"],
    audiences: ["propriétaires", "agences"],
    externalDependencies: ["PostgreSQL"],
    qualityMetrics: ["délai de première réponse (analytics conversion)"],
    controls: ["règles versionnées dans le code", "pas de ML"],
    disableConditions: ["le tri reste possible par date"],
    configOrModelVersion: "inquiry-priority-v1",
    risks: ["favoriser les comptes déjà actifs si signaux manquants"],
  },
  {
    id: "trust_listing_risk",
    name: "Détection d’annonces à risque",
    purpose:
      "Déclencher une évaluation Trust, jamais une preuve de fraude automatique.",
    technicalOwner: "TrustModule",
    productOwner: "Confiance",
    kind: "deterministic_rules",
    status: "operational",
    automation: "assisted_moderation",
    risk: "high",
    inputs: ["contenu d’annonce", "documents", "signaux Trust"],
    outputs: ["TrustSignal", "codes de risque"],
    audiences: ["modération", "annonceurs concernés"],
    externalDependencies: ["PostgreSQL"],
    qualityMetrics: ["taux de faux positifs revus", "délai de revue"],
    controls: [
      "un signal déclenche une revue humaine",
      "pas de suspension LLM",
    ],
    disableConditions: [
      "les règles restent dans Trust ; pas de kill-switch IA séparé",
    ],
    configOrModelVersion: "listing-risk-v1",
    risks: ["pénaliser des annonces légitimes", "confusion signal ≠ fraude"],
  },
  {
    id: "remote_ranker",
    name: "Moteur distant de recommandation",
    purpose: "Classement optionnel via FastAPI (contrat /v1/rank).",
    technicalOwner: "services/recommendation + RemoteRecommendationEngine",
    productOwner: "Découverte",
    kind: "remote_optional",
    status: "stub",
    automation: "none",
    risk: "moderate",
    inputs: ["candidats publicId + features, sans identité"],
    outputs: ["ordre + scores bornés 0..1"],
    audiences: ["aucun utilisateur tant que stub"],
    externalDependencies: ["RECOMMENDATION_SERVICE_URL"],
    qualityMetrics: ["shadow agree/disagree", "recommendation_fallback_total"],
    controls: ["repli rules", "shadow sans exposition", "timeout"],
    disableConditions: ["RECOMMENDATION_ENGINE=rules"],
    configOrModelVersion: "remote-v1 (non servi : /health seulement)",
    risks: ["latence", "classement non explicable si ML futur"],
  },
] as const

export function getAiSystem(id: string): AiSystemRecord | undefined {
  return AI_SYSTEM_REGISTRY.find((system) => system.id === id)
}
