import type {
  AmenityCategory,
  ModerationAction,
  PropertyCategory,
} from "../../src/generated/prisma/client"

export const COUNTRY = { code: "CI", name: "Côte d'Ivoire" } as const

export const DISTRICT = {
  code: "ABIDJAN",
  name: "District Autonome d'Abidjan",
} as const

export const CITY = { code: "ABIDJAN", name: "Abidjan" } as const

interface CommuneSeed {
  code: string
  name: string
  neighborhoods: ReadonlyArray<{ code: string; name: string }>
}

// Anyama et Bingerville sont des sous-préfectures du District : on les rattache
// à la ville d'Abidjan pour simplifier la navigation, comme les 10 communes.
export const COMMUNES: readonly CommuneSeed[] = [
  {
    code: "COCODY",
    name: "Cocody",
    neighborhoods: [
      { code: "RIVIERA", name: "Riviera" },
      { code: "ANGRE", name: "Angré" },
      { code: "DEUX_PLATEAUX", name: "Deux Plateaux" },
      { code: "BLOCKHAUS", name: "Blockhaus" },
    ],
  },
  {
    code: "MARCORY",
    name: "Marcory",
    neighborhoods: [
      { code: "ZONE_4", name: "Zone 4" },
      { code: "BIETRY", name: "Biétry" },
      { code: "ANOUMABO", name: "Anoumabo" },
    ],
  },
  {
    code: "YOPOUGON",
    name: "Yopougon",
    neighborhoods: [
      { code: "NIANGON", name: "Niangon" },
      { code: "SELMER", name: "Selmer" },
      { code: "TOITS_ROUGES", name: "Toits Rouges" },
    ],
  },
  {
    code: "ABOBO",
    name: "Abobo",
    neighborhoods: [
      { code: "AVOCATIER", name: "Avocatier" },
      { code: "PK18", name: "PK 18" },
    ],
  },
  {
    code: "PLATEAU",
    name: "Plateau",
    neighborhoods: [
      { code: "CENTRE_AFFAIRES", name: "Centre des affaires" },
      { code: "PLATEAU_DOKUI", name: "Plateau Dokui" },
    ],
  },
  {
    code: "TREICHVILLE",
    name: "Treichville",
    neighborhoods: [
      { code: "ARRAS", name: "Arras" },
      { code: "BIAFRA", name: "Biafra" },
    ],
  },
  {
    code: "ADJAME",
    name: "Adjamé",
    neighborhoods: [
      { code: "WILLIAMSVILLE", name: "Williamsville" },
      { code: "BRACODI", name: "Bracodi" },
    ],
  },
  {
    code: "PORT_BOUET",
    name: "Port-Bouët",
    neighborhoods: [
      { code: "VRIDI", name: "Vridi" },
      { code: "GONZAGUEVILLE", name: "Gonzagueville" },
    ],
  },
  {
    code: "KOUMASSI",
    name: "Koumassi",
    neighborhoods: [
      { code: "REMBLAIS", name: "Remblais" },
      { code: "SOPIM", name: "Sopim" },
    ],
  },
  {
    code: "ATTECOUBE",
    name: "Attécoubé",
    neighborhoods: [
      { code: "LOCODJORO", name: "Locodjoro" },
      { code: "SANTE", name: "Santé" },
    ],
  },
  {
    code: "ANYAMA",
    name: "Anyama",
    neighborhoods: [{ code: "ANYAMA_CENTRE", name: "Anyama Centre" }],
  },
  {
    code: "BINGERVILLE",
    name: "Bingerville",
    neighborhoods: [
      { code: "BINGERVILLE_CENTRE", name: "Bingerville Centre" },
      { code: "FEH_KESSE", name: "Féh Kessé" },
    ],
  },
]

export const ROLES = [
  {
    code: "CUSTOMER",
    name: "Client",
    description: "Recherche, favoris, demandes de visite",
  },
  {
    code: "OWNER",
    name: "Propriétaire",
    description: "Gère ses biens et annonces",
  },
  {
    code: "AGENT",
    name: "Agent immobilier",
    description: "Gère des biens pour le compte de propriétaires",
  },
  {
    code: "AGENCY",
    name: "Agence",
    description: "Compte agence regroupant des agents",
  },
  {
    code: "MODERATOR",
    name: "Modérateur",
    description: "Valide les annonces, instruit vérifications et signalements",
  },
  {
    code: "TRUST_OFFICER",
    name: "Responsable confiance",
    description:
      "Décide des vérifications (approbation, rejet, révocation) après examen des pièces",
  },
  {
    code: "SUPPORT",
    name: "Support client",
    description:
      "Consulte les comptes, révoque les sessions, ajoute des notes internes ; ne change ni rôles ni identifiants",
  },
  {
    code: "ANALYST",
    name: "Analyste",
    description: "Tableau de bord et statistiques globales en lecture seule",
  },
  {
    code: "ADMIN",
    name: "Administrateur",
    description: "Administration de la plateforme",
  },
  {
    code: "SUPER_ADMIN",
    name: "Super administrateur",
    description: "Accès complet, gestion des administrateurs",
  },
] as const

export const PERMISSIONS = [
  { code: "property:create", name: "Créer un bien" },
  { code: "property:read", name: "Consulter un bien" },
  { code: "property:update", name: "Modifier un bien" },
  { code: "property:delete", name: "Supprimer un bien" },
  { code: "property:manage", name: "Gérer tous les biens (administration)" },
  { code: "listing:create", name: "Créer une annonce" },
  { code: "listing:update", name: "Modifier une annonce" },
  { code: "listing:publish", name: "Publier une annonce" },
  { code: "listing:delete", name: "Supprimer une annonce" },
  { code: "listing:suspend", name: "Suspendre une annonce" },
  { code: "listing:moderate", name: "Valider ou refuser une annonce en revue" },
  {
    code: "listing:manage",
    name: "Gérer toutes les annonces (administration)",
  },
  { code: "user:read", name: "Consulter un utilisateur" },
  { code: "user:update", name: "Modifier un utilisateur" },
  { code: "user:suspend", name: "Suspendre un utilisateur" },
  { code: "verification:read", name: "Consulter une vérification" },
  { code: "verification:review", name: "Instruire une vérification" },
  { code: "verification:approve", name: "Approuver une vérification" },
  { code: "verification:create", name: "Demander une vérification" },
  { code: "verification:reject", name: "Rejeter une vérification" },
  { code: "verification:revoke", name: "Révoquer une vérification" },
  {
    code: "verification:documents",
    name: "Consulter les pièces justificatives d'une vérification",
  },
  {
    code: "report:create",
    name: "Signaler une annonce, un utilisateur ou un message",
  },
  { code: "report:review", name: "Traiter les signalements" },
  {
    code: "trust_score:read",
    name: "Consulter le score de confiance détaillé",
  },
  {
    code: "analytics:read",
    name: "Consulter les statistiques de ses annonces",
  },
  {
    code: "analytics:admin",
    name: "Consulter les statistiques globales de la plateforme",
  },
  {
    code: "ai:admin",
    name: "Consulter le portefeuille et les évaluations des systèmes IA",
  },
  { code: "conversation:create", name: "Contacter un annonceur" },
  { code: "appointment:request", name: "Demander une visite" },
  { code: "admin:access", name: "Accéder au back-office" },
  {
    code: "user:pii",
    name: "Voir l'e-mail et le téléphone complets d'un utilisateur",
  },
  { code: "user:reactivate", name: "Réactiver un compte suspendu" },
  { code: "user:ban", name: "Bannir un compte" },
  {
    code: "user:revoke_sessions",
    name: "Déconnecter un utilisateur de tous ses appareils",
  },
  { code: "admin_note:create", name: "Ajouter une note interne" },
  { code: "role:read", name: "Consulter les rôles et permissions" },
  { code: "role:manage", name: "Attribuer ou retirer un rôle" },
  { code: "audit_log:read", name: "Consulter le journal d'audit" },
  {
    code: "settings:manage",
    name: "Gérer les motifs de modération",
  },
  {
    code: "billing:purchase",
    name: "Souscrire un abonnement aux services de la plateforme",
  },
  {
    code: "billing:read",
    name: "Consulter commandes, paiements, abonnements et incidents",
  },
  { code: "billing:catalog", name: "Gérer les plans et les tarifs" },
  { code: "billing:refund_request", name: "Demander un remboursement" },
  { code: "billing:refund", name: "Approuver ou refuser un remboursement" },
  {
    code: "billing:reconcile",
    name: "Relancer la vérification d'un paiement et clore un incident",
  },
  {
    code: "partner:read",
    name: "Consulter le registre des partenaires et intégrations",
  },
  {
    code: "partner:manage",
    name: "Gérer les partenaires, intégrations et imports",
  },
] as const

type RoleCode = (typeof ROLES)[number]["code"]
type PermissionCode = (typeof PERMISSIONS)[number]["code"]

const ALL_PERMISSIONS = PERMISSIONS.map((permission) => permission.code)

/**
 * Pièces personnelles : réservées aux rôles d'instruction et de décision.
 * L'administration technique ne les reçoit pas par défaut.
 */
const PERSONAL_DOCUMENT_PERMISSIONS: PermissionCode[] = [
  "verification:documents",
]

const MEMBER_PERMISSIONS: PermissionCode[] = [
  "verification:create",
  "report:create",
  "conversation:create",
  "appointment:request",
]

const PUBLISHER_PERMISSIONS: PermissionCode[] = [
  "property:create",
  "property:read",
  "property:update",
  "property:delete",
  "listing:create",
  "listing:update",
  "listing:publish",
  "listing:delete",
  "analytics:read",
  "billing:purchase",
]

// Le seed ajoute les associations manquantes mais n'en retire jamais :
// un retrait de droit passe par une migration de données explicite.
// Décider (approuver, rejeter, révoquer) est réservé à TRUST_OFFICER ; le
// modérateur instruit (affecte, demande un complément, voit les pièces).
export const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  CUSTOMER: ["property:read", ...MEMBER_PERMISSIONS],
  OWNER: [...PUBLISHER_PERMISSIONS, ...MEMBER_PERMISSIONS],
  AGENT: [...PUBLISHER_PERMISSIONS, ...MEMBER_PERMISSIONS],
  AGENCY: [...PUBLISHER_PERMISSIONS, ...MEMBER_PERMISSIONS],
  MODERATOR: [
    "property:read",
    "listing:publish",
    "listing:suspend",
    "listing:moderate",
    "user:read",
    "verification:read",
    "verification:review",
    "verification:documents",
    "report:review",
    "admin:access",
    "admin_note:create",
    ...MEMBER_PERMISSIONS,
  ],
  TRUST_OFFICER: [
    "property:read",
    "user:read",
    "user:pii",
    "verification:read",
    "verification:review",
    "verification:documents",
    "verification:approve",
    "verification:reject",
    "verification:revoke",
    "report:review",
    "trust_score:read",
    "admin:access",
    "admin_note:create",
    ...MEMBER_PERMISSIONS,
  ],
  SUPPORT: [
    "property:read",
    "user:read",
    "user:pii",
    "user:revoke_sessions",
    "admin:access",
    "admin_note:create",
    "billing:read",
    "billing:refund_request",
  ],
  ANALYST: ["admin:access", "analytics:admin", "ai:admin", "partner:read"],
  ADMIN: ALL_PERMISSIONS.filter(
    (code) => !PERSONAL_DOCUMENT_PERMISSIONS.includes(code),
  ),
  SUPER_ADMIN: ALL_PERMISSIONS,
}

export const PROPERTY_TYPES: ReadonlyArray<{
  code: string
  name: string
  category: PropertyCategory
}> = [
  { code: "APARTMENT", name: "Appartement", category: "RESIDENTIAL" },
  { code: "STUDIO", name: "Studio", category: "RESIDENTIAL" },
  { code: "HOUSE", name: "Maison", category: "RESIDENTIAL" },
  { code: "VILLA", name: "Villa", category: "RESIDENTIAL" },
  { code: "DUPLEX", name: "Duplex", category: "RESIDENTIAL" },
  { code: "RESIDENCE", name: "Résidence meublée", category: "RESIDENTIAL" },
  { code: "LAND", name: "Terrain", category: "LAND" },
  { code: "OFFICE", name: "Bureau", category: "COMMERCIAL" },
  { code: "SHOP", name: "Magasin", category: "COMMERCIAL" },
  { code: "WAREHOUSE", name: "Entrepôt", category: "INDUSTRIAL" },
  { code: "BUILDING", name: "Immeuble", category: "MIXED" },
]

export const AMENITIES: ReadonlyArray<{
  code: string
  name: string
  category: AmenityCategory
}> = [
  { code: "PARKING", name: "Parking", category: "OUTDOOR" },
  { code: "SWIMMING_POOL", name: "Piscine", category: "OUTDOOR" },
  { code: "SECURITY", name: "Gardiennage", category: "SECURITY" },
  { code: "AIR_CONDITIONING", name: "Climatisation", category: "COMFORT" },
  { code: "GARDEN", name: "Jardin", category: "OUTDOOR" },
  { code: "GENERATOR", name: "Groupe électrogène", category: "ENERGY" },
  { code: "WATER_TANK", name: "Réserve d'eau", category: "WATER" },
  { code: "ELEVATOR", name: "Ascenseur", category: "ACCESSIBILITY" },
  { code: "BALCONY", name: "Balcon", category: "OUTDOOR" },
  { code: "FURNISHED", name: "Meublé", category: "FURNITURE" },
  { code: "WIFI", name: "Wi-Fi", category: "CONNECTIVITY" },
  { code: "FITTED_KITCHEN", name: "Cuisine équipée", category: "FURNITURE" },
]

/**
 * Plan des comptes sans abonnement. Créé s'il manque, jamais écrasé : un
 * administrateur fixe ensuite sa limite (NULL = illimité) depuis le back-office.
 * Aucun tarif : il n'est jamais vendu.
 */
export const DEFAULT_BILLING_PLAN = {
  code: "FREE",
  kind: "SUBSCRIPTION_PLAN",
  status: "ACTIVE",
  name: "Gratuit",
  description: "Plan appliqué aux comptes sans abonnement payant.",
  isDefault: true,
  maxActiveListings: null,
  sortOrder: 0,
} as const

/**
 * Motifs de modération initiaux. Créés s'ils manquent, jamais écrasés : les
 * administrateurs les modifient ensuite depuis le back-office.
 */
export const MODERATION_REASONS: ReadonlyArray<{
  code: string
  action: ModerationAction
  label: string
  ownerMessage: string
  sortOrder: number
}> = [
  {
    code: "INCOMPLETE_INFORMATION",
    action: "REQUEST_CHANGES",
    label: "Informations incomplètes",
    ownerMessage:
      "Certaines informations de votre annonce sont incomplètes. Complétez-la puis soumettez-la de nouveau.",
    sortOrder: 10,
  },
  {
    code: "PHOTOS_QUALITY",
    action: "REQUEST_CHANGES",
    label: "Photos insuffisantes ou inadaptées",
    ownerMessage:
      "Les photos de votre annonce ne permettent pas de présenter correctement le bien. Remplacez-les puis soumettez l'annonce de nouveau.",
    sortOrder: 20,
  },
  {
    code: "PRICE_INCONSISTENT",
    action: "REQUEST_CHANGES",
    label: "Prix incohérent",
    ownerMessage:
      "Le prix indiqué semble incohérent avec le bien. Vérifiez-le puis soumettez l'annonce de nouveau.",
    sortOrder: 30,
  },
  {
    code: "PROHIBITED_CONTENT",
    action: "REJECT",
    label: "Contenu interdit",
    ownerMessage:
      "Votre annonce contient un contenu contraire aux règles de publication de Mon Appart.",
    sortOrder: 10,
  },
  {
    code: "DUPLICATE_LISTING",
    action: "REJECT",
    label: "Annonce en double",
    ownerMessage:
      "Cette annonce fait doublon avec une annonce existante pour le même bien.",
    sortOrder: 20,
  },
  {
    code: "MISLEADING_LISTING",
    action: "REJECT",
    label: "Annonce trompeuse",
    ownerMessage:
      "Votre annonce contient des informations qui ne correspondent pas au bien proposé.",
    sortOrder: 30,
  },
  {
    code: "UNDER_INVESTIGATION",
    action: "SUSPEND",
    label: "Vérification en cours",
    ownerMessage:
      "Votre annonce est temporairement suspendue le temps d'une vérification. Vous serez informé de la suite.",
    sortOrder: 10,
  },
  {
    code: "POLICY_VIOLATION",
    action: "SUSPEND",
    label: "Non-respect des règles de publication",
    ownerMessage:
      "Votre annonce est suspendue car elle ne respecte pas les règles de publication de Mon Appart.",
    sortOrder: 20,
  },
]
