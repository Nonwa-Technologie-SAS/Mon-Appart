import {
  LISTING_TYPES,
  RECOMMENDATION_CONTEXTS,
  SEARCH_SORTS,
  SUGGESTION_TYPES,
} from "@mon-appart/types"
import { z } from "zod"

import { ACQUISITION_CHANNELS, ACQUISITION_TOUCH_KINDS } from "./acquisition"

/**
 * Catalogue officiel des événements analytiques. Toute propriété est décrite
 * ici : un objet strict refuse les clés inconnues, et aucun champ ne porte de
 * texte libre (codes, identifiants publics, compteurs et énumérations).
 */

export const TRAFFIC_SOURCES = [
  "SEARCH",
  "RECOMMENDATION",
  "DIRECT",
  "FAVORITE",
  "NOTIFICATION",
  "SHARE",
] as const
export const LIST_CONTEXTS = [
  "SEARCH",
  "MAP",
  "RECOMMENDATION",
  "SIMILAR",
  "HOME",
  "FAVORITES",
] as const
export const SEARCH_FILTERS = [
  "TEXT",
  "LISTING_TYPE",
  "PROPERTY_TYPE",
  "CITY",
  "COMMUNE",
  "NEIGHBORHOOD",
  "PRICE",
  "SURFACE",
  "LAND_SURFACE",
  "BEDROOMS",
  "BATHROOMS",
  "AMENITIES",
  "RADIUS",
] as const
export const GALLERY_ACTIONS = [
  "OPENED",
  "NEXT",
  "FULLSCREEN",
  "VIDEO_PLAYED",
  "VIRTUAL_TOUR_OPENED",
] as const
export const SHARE_CHANNELS = [
  "COPY_LINK",
  "NATIVE",
  "WHATSAPP",
  "FACEBOOK",
  "SMS",
  "EMAIL",
  "OTHER",
] as const
export const CONTACT_METHODS = ["FORM", "PHONE", "WHATSAPP"] as const
export const BUDGET_BUCKETS = [
  "UNDER_100K",
  "100K_250K",
  "250K_500K",
  "500K_1M",
  "1M_5M",
  "5M_25M",
  "25M_100M",
  "OVER_100M",
] as const
export const SENDER_SIDES = ["REQUESTER", "LISTING"] as const
export const LEAD_RULES = [
  "REPLY",
  "APPOINTMENT",
  "REPLY_OR_APPOINTMENT",
] as const
export const CONVERSION_KINDS = ["CONTACT", "APPOINTMENT"] as const
export const BILLING_ORDER_KINDS = [
  "SUBSCRIPTION_START",
  "SUBSCRIPTION_RENEWAL",
] as const
export const PAYMENT_FAILURES = ["FAILED", "CANCELLED", "EXPIRED"] as const
export const SUBSCRIPTION_CANCEL_REASONS = [
  "USER_REQUEST",
  "FULL_REFUND",
] as const
/** Retours explicites ; l'affichage, le clic et le rejet ont leur propre événement. */
export const EXPLICIT_FEEDBACK = [
  "INTERESTED",
  "IRRELEVANT",
  "WRONG_BUDGET",
  "WRONG_LOCATION",
] as const
export const VISIT_FEEDBACK_OUTCOMES = [
  "PENDING_DECISION",
  "STILL_INTERESTED",
  "NEED_INFO",
  "WANT_ANOTHER_VISIT",
  "NOT_A_FIT",
  "UNAVAILABLE",
  "PROJECT_ABANDONED",
  "PROJECT_COMPLETED",
] as const

export type BudgetBucket = (typeof BUDGET_BUCKETS)[number]
export type LeadRule = (typeof LEAD_RULES)[number]
export type ConversionKind = (typeof CONVERSION_KINDS)[number]
export type ExplicitFeedback = (typeof EXPLICIT_FEEDBACK)[number]

const BUCKET_LIMITS: ReadonlyArray<readonly [number, BudgetBucket]> = [
  [100_000, "UNDER_100K"],
  [250_000, "100K_250K"],
  [500_000, "250K_500K"],
  [1_000_000, "500K_1M"],
  [5_000_000, "1M_5M"],
  [25_000_000, "5M_25M"],
  [100_000_000, "25M_100M"],
]

/** Tranche de budget (XOF) : on ne conserve jamais le montant exact. */
export function budgetBucket(
  amount: number | null | undefined,
): BudgetBucket | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return null
  }
  if (amount < 0) return null
  for (const [limit, bucket] of BUCKET_LIMITS) {
    if (amount < limit) return bucket
  }
  return "OVER_100M"
}

const publicId = z.uuid()
const position = z.int().min(1).max(500)
const counter = z.int().min(0).max(100_000)
const code = z.string().regex(/^[A-Z0-9_]{1,40}$/)
const algorithmVersion = z.string().regex(/^[A-Za-z0-9._-]{1,50}$/)
const fieldName = z.string().regex(/^[a-zA-Z]{1,40}$/)
const providerCode = z.string().regex(/^[a-z0-9_]{1,30}$/)

/**
 * Route normalisée (modèle, pas URL) : `/annonces/[id]`. Ni requête, ni
 * fragment, ni segment pouvant porter un identifiant ou une donnée saisie.
 */
const route = z
  .string()
  .max(120)
  .regex(/^\/[a-z0-9\-/[\]]*$/)
  .refine(
    (value) =>
      value
        .split("/")
        .every(
          (segment) =>
            segment.length <= 40 &&
            !/\d{3,}/.test(segment) &&
            !/^[0-9a-f-]{16,}$/.test(segment),
        ),
    "segment non normalisé",
  )

export type EventOrigin = "client" | "server"
export type EventCategory =
  | "navigation"
  | "interest"
  | "recommendation"
  | "listing"
  | "account"
  | "conversion"
  | "billing"

export interface EventDefinition<
  TSchema extends z.ZodObject = z.ZodObject,
  TOrigin extends EventOrigin = EventOrigin,
> {
  origin: TOrigin
  category: EventCategory
  /** Quand l'émettre : sert de documentation et de revue. */
  description: string
  version: number
  schema: TSchema
  /** Schémas des versions antérieures encore acceptées. */
  legacy?: Readonly<Record<number, z.ZodObject>>
  /** Propriété portant l'identifiant public de l'annonce concernée. */
  listingKey?: string
  /** Faux si aucun émetteur n'existe encore (fonctionnalité absente). */
  instrumented: boolean
}

function event<TSchema extends z.ZodObject, TOrigin extends EventOrigin>(
  definition: Omit<EventDefinition<TSchema, TOrigin>, "instrumented"> & {
    instrumented?: boolean
  },
): EventDefinition<TSchema, TOrigin> {
  return { instrumented: true, ...definition }
}

const empty = z.strictObject({})
const listingRef = { listingId: publicId }
const recommendationRef = {
  recommendationRequestId: publicId,
  algorithmVersion,
}

export const EVENTS = {
  // A. Navigation et découverte (client, consentement analytique requis)
  app_opened: event({
    origin: "client",
    category: "navigation",
    description: "Démarrage de l'application ou première page d'une visite.",
    version: 1,
    schema: empty,
  }),
  page_viewed: event({
    origin: "client",
    category: "navigation",
    description: "Affichage d'un écran ; route normalisée, jamais l'URL.",
    version: 1,
    schema: z.strictObject({ route }),
  }),
  acquisition_touch: event({
    origin: "client",
    category: "navigation",
    description:
      "Premier contact d’acquisition de la visite (UTM normalisés + host referrer). Consentement requis. Pas une preuve de causalité publicitaire.",
    version: 1,
    schema: z.strictObject({
      channel: z.enum(ACQUISITION_CHANNELS),
      utmSource: code.nullable(),
      utmMedium: code.nullable(),
      utmCampaign: code.nullable(),
      referrerHost: code.nullable(),
      landingRoute: route,
      touchKind: z.enum(ACQUISITION_TOUCH_KINDS),
    }),
  }),
  search_submitted: event({
    origin: "server",
    category: "navigation",
    description:
      "Recherche soumise (première page). Filtres utilisés et codes de lieu, budget en tranche, jamais le texte saisi.",
    version: 1,
    schema: z.strictObject({
      resultCount: counter,
      sort: z.enum(SEARCH_SORTS),
      filters: z.array(z.enum(SEARCH_FILTERS)).max(SEARCH_FILTERS.length),
      listingType: z.enum(LISTING_TYPES).nullable(),
      propertyType: code.nullable(),
      commune: code.nullable(),
      budgetBucket: z.enum(BUDGET_BUCKETS).nullable(),
    }),
  }),
  search_results_viewed: event({
    origin: "client",
    category: "navigation",
    description: "Première page de résultats affichée après une recherche.",
    version: 1,
    schema: z.strictObject({
      resultCount: counter,
      page: z.int().min(1).max(50),
    }),
  }),
  search_filter_applied: event({
    origin: "client",
    category: "navigation",
    description: "Filtre ajouté ou modifié (nom du filtre, pas sa valeur).",
    version: 1,
    schema: z.strictObject({ filter: z.enum(SEARCH_FILTERS) }),
  }),
  search_sort_changed: event({
    origin: "client",
    category: "navigation",
    description: "Tri modifié par l'utilisateur.",
    version: 1,
    schema: z.strictObject({ sort: z.enum(SEARCH_SORTS) }),
  }),
  search_suggestion_selected: event({
    origin: "client",
    category: "navigation",
    description: "Suggestion d'autocomplétion choisie (type et rang).",
    version: 1,
    schema: z.strictObject({
      type: z.enum(SUGGESTION_TYPES),
      position,
    }),
  }),
  map_results_viewed: event({
    origin: "client",
    category: "navigation",
    description: "Résultats affichés sur la carte.",
    version: 1,
    schema: z.strictObject({ resultCount: counter }),
  }),
  listing_card_viewed: event({
    origin: "client",
    category: "navigation",
    description:
      "Carte d'annonce visible à l'écran (une fois par annonce et par liste).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      context: z.enum(LIST_CONTEXTS),
      position,
    }),
    listingKey: "listingId",
  }),
  listing_detail_viewed: event({
    origin: "client",
    category: "navigation",
    description: "Fiche d'une annonce publiée affichée.",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      source: z.enum(TRAFFIC_SOURCES),
    }),
    listingKey: "listingId",
  }),
  listing_gallery_interacted: event({
    origin: "client",
    category: "navigation",
    description: "Interaction avec la galerie (ouverture, vidéo, visite 360°).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      action: z.enum(GALLERY_ACTIONS),
    }),
    listingKey: "listingId",
  }),

  // B. Intérêt pour les biens
  listing_favorited: event({
    origin: "server",
    category: "interest",
    description: "Favori enregistré via POST /api/v1/interactions/favorites.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),
  listing_unfavorited: event({
    origin: "server",
    category: "interest",
    description: "Favori retiré via DELETE /api/v1/interactions/favorites.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),
  listing_shared: event({
    origin: "client",
    category: "interest",
    description: "Partage déclenché depuis la fiche (canal choisi).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      channel: z.enum(SHARE_CHANNELS),
    }),
    listingKey: "listingId",
  }),
  listing_contact_started: event({
    origin: "client",
    category: "interest",
    description:
      "Intention de contact (bouton, formulaire ouvert). Jamais un lead.",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      method: z.enum(CONTACT_METHODS),
    }),
    listingKey: "listingId",
  }),
  listing_contact_submitted: event({
    origin: "server",
    category: "conversion",
    description: "Demande de contact enregistrée (conversation créée).",
    version: 1,
    schema: z.strictObject({ ...listingRef, conversationId: publicId }),
    listingKey: "listingId",
  }),
  appointment_requested: event({
    origin: "server",
    category: "conversion",
    description: "Demande de visite enregistrée.",
    version: 1,
    schema: z.strictObject({ ...listingRef, appointmentId: publicId }),
    listingKey: "listingId",
  }),
  appointment_confirmed: event({
    origin: "server",
    category: "conversion",
    description: "Visite confirmée par l'annonceur (ou report accepté).",
    version: 1,
    schema: z.strictObject({ ...listingRef, appointmentId: publicId }),
    listingKey: "listingId",
  }),
  appointment_cancelled: event({
    origin: "server",
    category: "conversion",
    description: "Visite annulée par l'une des parties.",
    version: 1,
    schema: z.strictObject({ ...listingRef, appointmentId: publicId }),
    listingKey: "listingId",
  }),
  listing_report_submitted: event({
    origin: "server",
    category: "interest",
    description: "Signalement d'annonce enregistré (motif codé).",
    version: 1,
    schema: z.strictObject({ ...listingRef, reason: code }),
    listingKey: "listingId",
  }),

  // C. Recommandation
  recommendations_requested: event({
    origin: "server",
    category: "recommendation",
    description:
      "Page de recommandations servie (chaque page a son identifiant). Génération, pas exposition.",
    version: 1,
    schema: z.strictObject({
      ...recommendationRef,
      context: z.enum(RECOMMENDATION_CONTEXTS),
      itemCount: counter,
    }),
  }),
  recommendations_viewed: event({
    origin: "client",
    category: "recommendation",
    description: "Recommandations réellement affichées (exposition).",
    version: 1,
    schema: z.strictObject({
      ...recommendationRef,
      context: z.enum(RECOMMENDATION_CONTEXTS),
      items: z
        .array(z.strictObject({ listingId: publicId, position }))
        .min(1)
        .max(50),
    }),
  }),
  recommended_listing_opened: event({
    origin: "client",
    category: "recommendation",
    description: "Annonce recommandée ouverte depuis la liste.",
    version: 1,
    schema: z.strictObject({ ...recommendationRef, ...listingRef, position }),
    listingKey: "listingId",
  }),
  recommendation_feedback_submitted: event({
    origin: "server",
    category: "recommendation",
    description: "Retour explicite enregistré (hors affichage, clic et rejet).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      feedback: z.enum(EXPLICIT_FEEDBACK),
      algorithmVersion,
      position: position.nullable(),
    }),
    listingKey: "listingId",
  }),
  recommendation_dismissed: event({
    origin: "server",
    category: "recommendation",
    description: "Recommandation écartée (« pas intéressé »).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      algorithmVersion,
      position: position.nullable(),
    }),
    listingKey: "listingId",
  }),
  recommendation_converted: event({
    origin: "server",
    category: "recommendation",
    description:
      "Contact ou visite enregistré sur une annonce ouverte depuis une recommandation, dans la fenêtre d'attribution.",
    version: 1,
    schema: z.strictObject({
      ...recommendationRef,
      ...listingRef,
      conversion: z.enum(CONVERSION_KINDS),
    }),
    listingKey: "listingId",
  }),

  // D. Publication et gestion des annonces (backend uniquement)
  listing_creation_started: event({
    origin: "client",
    category: "listing",
    description: "Formulaire de création d'annonce ouvert.",
    version: 1,
    schema: empty,
  }),
  listing_creation_completed: event({
    origin: "server",
    category: "listing",
    description: "Annonce créée (brouillon enregistré).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      listingType: z.enum(LISTING_TYPES),
    }),
    listingKey: "listingId",
  }),
  listing_published: event({
    origin: "server",
    category: "listing",
    description: "Passage effectif au statut PUBLISHED.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),
  listing_updated: event({
    origin: "server",
    category: "listing",
    description: "Annonce modifiée (noms des champs, pas les valeurs).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      changedFields: z.array(fieldName).max(30),
    }),
    listingKey: "listingId",
  }),
  listing_paused: event({
    origin: "server",
    category: "listing",
    description: "Passage effectif au statut PAUSED.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),
  listing_expired: event({
    origin: "server",
    category: "listing",
    description: "Passage effectif au statut EXPIRED.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),
  listing_marked_as_rented: event({
    origin: "server",
    category: "listing",
    description: "Passage effectif au statut RENTED.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),
  listing_marked_as_sold: event({
    origin: "server",
    category: "listing",
    description: "Passage effectif au statut SOLD.",
    version: 1,
    schema: z.strictObject(listingRef),
    listingKey: "listingId",
  }),

  // E. Compte et activation (backend uniquement, sans donnée de vérification)
  registration_completed: event({
    origin: "server",
    category: "account",
    description: "Compte créé.",
    version: 1,
    schema: empty,
  }),
  email_verification_completed: event({
    origin: "server",
    category: "account",
    description: "Adresse e-mail vérifiée par OTP.",
    version: 1,
    schema: empty,
  }),
  phone_verification_completed: event({
    origin: "server",
    category: "account",
    description: "Numéro de téléphone vérifié par OTP.",
    version: 1,
    schema: empty,
  }),
  profile_completed: event({
    origin: "server",
    category: "account",
    description: "Profil complet (règle métier non définie).",
    version: 1,
    schema: empty,
    instrumented: false,
  }),
  owner_onboarding_completed: event({
    origin: "server",
    category: "account",
    description: "Parcours propriétaire terminé (parcours non défini).",
    version: 1,
    schema: empty,
    instrumented: false,
  }),

  // F. Messagerie et conversion (métadonnées uniquement)
  conversation_created: event({
    origin: "server",
    category: "conversion",
    description: "Conversation ouverte sur une annonce.",
    version: 1,
    schema: z.strictObject({ ...listingRef, conversationId: publicId }),
    listingKey: "listingId",
  }),
  message_sent: event({
    origin: "server",
    category: "conversion",
    description: "Message enregistré (côté et type, jamais le contenu).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      conversationId: publicId,
      side: z.enum(SENDER_SIDES),
      withAttachments: z.boolean(),
    }),
    listingKey: "listingId",
  }),
  message_reply_received: event({
    origin: "server",
    category: "conversion",
    description:
      "Première réponse du côté annonce dans une conversation (délai en secondes).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      conversationId: publicId,
      responseSeconds: z.int().min(0).max(31_536_000),
    }),
    listingKey: "listingId",
  }),
  appointment_completed: event({
    origin: "server",
    category: "conversion",
    description: "Visite marquée réalisée par l'annonceur.",
    version: 1,
    schema: z.strictObject({ ...listingRef, appointmentId: publicId }),
    listingKey: "listingId",
  }),
  qualified_lead_recorded: event({
    origin: "server",
    category: "conversion",
    description:
      "Conversation devenue lead qualifié selon la règle configurée (une fois par conversation).",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      conversationId: publicId,
      rule: z.enum(LEAD_RULES),
    }),
    listingKey: "listingId",
  }),

  // G. Monétisation (backend uniquement, sans montant ni donnée de paiement)
  checkout_started: event({
    origin: "server",
    category: "billing",
    description: "Commande de plan créée (prix fixé par le serveur).",
    version: 1,
    schema: z.strictObject({
      orderId: publicId,
      orderKind: z.enum(BILLING_ORDER_KINDS),
      productCode: code,
    }),
  }),
  payment_attempt_created: event({
    origin: "server",
    category: "billing",
    description: "Tentative de paiement ouverte chez le prestataire.",
    version: 1,
    schema: z.strictObject({
      orderId: publicId,
      paymentId: publicId,
      provider: providerCode,
    }),
  }),
  payment_succeeded: event({
    origin: "server",
    category: "billing",
    description:
      "Paiement confirmé par le prestataire (webhook signé ou interrogation), relu en base.",
    version: 1,
    schema: z.strictObject({
      orderId: publicId,
      paymentId: publicId,
      provider: providerCode,
    }),
  }),
  payment_failed: event({
    origin: "server",
    category: "billing",
    description: "Tentative échouée, annulée ou expirée.",
    version: 1,
    schema: z.strictObject({
      orderId: publicId,
      paymentId: publicId,
      provider: providerCode,
      status: z.enum(PAYMENT_FAILURES),
    }),
  }),
  subscription_started: event({
    origin: "server",
    category: "billing",
    description: "Premier droit d'abonnement accordé après paiement confirmé.",
    version: 1,
    schema: z.strictObject({ subscriptionId: publicId, productCode: code }),
  }),
  subscription_renewed: event({
    origin: "server",
    category: "billing",
    description: "Période supplémentaire accordée après paiement confirmé.",
    version: 1,
    schema: z.strictObject({ subscriptionId: publicId, productCode: code }),
  }),
  subscription_cancelled: event({
    origin: "server",
    category: "billing",
    description:
      "Résiliation demandée (effet à l'échéance) ou fin anticipée après remboursement total.",
    version: 1,
    schema: z.strictObject({
      subscriptionId: publicId,
      productCode: code,
      reason: z.enum(SUBSCRIPTION_CANCEL_REASONS),
    }),
  }),
  refund_requested: event({
    origin: "server",
    category: "billing",
    description: "Demande de remboursement enregistrée (client ou équipe).",
    version: 1,
    schema: z.strictObject({
      refundId: publicId,
      paymentId: publicId,
      byCustomer: z.boolean(),
    }),
  }),
  refund_completed: event({
    origin: "server",
    category: "billing",
    description: "Remboursement confirmé par le prestataire, relu en base.",
    version: 1,
    schema: z.strictObject({ refundId: publicId, paymentId: publicId }),
  }),

  // H. Rétention (identifiants publics et codes, jamais de note privée)
  saved_search_created: event({
    origin: "server",
    category: "interest",
    description: "Recherche persistante créée par l'utilisateur.",
    version: 1,
    schema: z.strictObject({ alertsEnabled: z.boolean() }),
  }),
  saved_search_updated: event({
    origin: "server",
    category: "interest",
    description: "Recherche persistante modifiée.",
    version: 1,
    schema: z.strictObject({ alertsEnabled: z.boolean() }),
  }),
  property_alert_eligible: event({
    origin: "server",
    category: "interest",
    description:
      "Annonces pertinentes détectées pour une recherche sauvegardée.",
    version: 1,
    schema: z.strictObject({
      savedSearchId: publicId,
      exactCount: counter,
      nearCount: counter,
    }),
  }),
  property_alert_sent: event({
    origin: "server",
    category: "interest",
    description:
      "Digest d'alertes créé (préférences et déduplication respectées).",
    version: 1,
    schema: z.strictObject({
      savedSearchId: publicId,
      listingCount: counter,
      reactivation: z.boolean(),
    }),
  }),
  property_alert_opened: event({
    origin: "client",
    category: "interest",
    description: "Ouverture d'une alerte immobilière.",
    version: 1,
    instrumented: false,
    schema: z.strictObject({ savedSearchId: publicId }),
  }),
  property_alert_clicked: event({
    origin: "client",
    category: "interest",
    description: "Clic vers une annonce depuis une alerte.",
    version: 1,
    instrumented: false,
    schema: z.strictObject({
      savedSearchId: publicId,
      listingId: publicId,
    }),
    listingKey: "listingId",
  }),
  post_visit_feedback_submitted: event({
    origin: "server",
    category: "conversion",
    description: "Retour facultatif après une visite réalisée.",
    version: 1,
    schema: z.strictObject({
      ...listingRef,
      appointmentId: publicId,
      outcome: z.enum(VISIT_FEEDBACK_OUTCOMES),
      shared: z.boolean(),
    }),
    listingKey: "listingId",
  }),
  search_resumed: event({
    origin: "server",
    category: "interest",
    description: "Reprise d'une recherche enregistrée.",
    version: 1,
    schema: z.strictObject({ savedSearchId: publicId }),
  }),
  reactivation_eligible: event({
    origin: "server",
    category: "interest",
    description:
      "Utilisateur éligible à une réactivation (annonces pertinentes).",
    version: 1,
    schema: z.strictObject({ savedSearchId: publicId }),
  }),
  reactivation_sent: event({
    origin: "server",
    category: "interest",
    description: "Digest de réactivation créé.",
    version: 1,
    schema: z.strictObject({
      savedSearchId: publicId,
      listingCount: counter,
      reactivation: z.boolean(),
    }),
  }),
  reactivation_returned: event({
    origin: "client",
    category: "interest",
    description: "Retour sur le site après une réactivation.",
    version: 1,
    instrumented: false,
    schema: empty,
  }),
  notification_preferences_updated: event({
    origin: "server",
    category: "account",
    description: "Préférences de notification modifiées.",
    version: 1,
    schema: z.strictObject({ marketingDisabled: z.boolean() }),
  }),
  marketing_unsubscribed: event({
    origin: "server",
    category: "account",
    description: "Désactivation d'au moins un canal marketing.",
    version: 1,
    schema: empty,
  }),
  property_marked_unavailable: event({
    origin: "server",
    category: "listing",
    description: "Notification d'indisponibilité d'un bien suivi.",
    version: 1,
    schema: z.strictObject({ ...listingRef }),
    listingKey: "listingId",
  }),
  project_marked_completed: event({
    origin: "server",
    category: "account",
    description: "Projet immobilier déclaré terminé par l'utilisateur.",
    version: 1,
    schema: empty,
  }),
} as const satisfies Record<string, EventDefinition>

export type EventName = keyof typeof EVENTS
export type EventProperties<TName extends EventName> = z.input<
  (typeof EVENTS)[TName]["schema"]
>

type NamesOf<TOrigin extends EventOrigin> = {
  [K in EventName]: (typeof EVENTS)[K]["origin"] extends TOrigin ? K : never
}[EventName]

export type ClientEventName = NamesOf<"client">
export type ServerEventName = NamesOf<"server">

export const EVENT_NAMES = Object.keys(EVENTS) as EventName[]
export const CLIENT_EVENT_NAMES = EVENT_NAMES.filter(
  (name) => EVENTS[name].origin === "client",
) as ClientEventName[]
export const SERVER_EVENT_NAMES = EVENT_NAMES.filter(
  (name) => EVENTS[name].origin === "server",
) as ServerEventName[]

export function isEventName(name: string): name is EventName {
  return Object.hasOwn(EVENTS, name)
}

export function definitionOf(name: EventName): EventDefinition {
  return EVENTS[name]
}
