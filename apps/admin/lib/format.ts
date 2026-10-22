const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Africa/Abidjan",
})

const number = new Intl.NumberFormat("fr-FR")

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date)
}

export function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  const parsed = typeof value === "string" ? Number(value) : value
  return Number.isFinite(parsed) ? number.format(parsed) : "—"
}

export function formatPrice(
  price: { amount: string; currency: string; period: string } | null,
): string {
  if (!price) return "Sans prix"
  const period = PERIOD_LABELS[price.period]
  return `${formatNumber(price.amount)} ${price.currency}${period ? ` / ${period}` : ""}`
}

/** Ancienneté lisible d'un élément en file d'attente. */
export function formatAge(value: string | null, now = Date.now()): string {
  if (!value) return "—"
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}

const PERIOD_LABELS: Record<string, string> = {
  MONTH: "mois",
  DAY: "jour",
  WEEK: "semaine",
  YEAR: "an",
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  INACTIVE: "Inactif",
  SUSPENDED: "Suspendu",
  BANNED: "Banni",
  DRAFT: "Brouillon",
  PENDING_REVIEW: "À valider",
  PUBLISHED: "Publiée",
  PAUSED: "En pause",
  EXPIRED: "Expirée",
  ARCHIVED: "Archivée",
  SOLD: "Vendue",
  RENTED: "Louée",
  OPEN: "Ouvert",
  IN_REVIEW: "En examen",
  RESOLVED: "Clos",
  DISMISSED: "Écarté",
  CONFIRMED: "Confirmé",
  NEEDS_MORE_INFORMATION: "Complément demandé",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
  REVOKED: "Révoquée",
  VERIFIED: "Vérifiée",
  SUBMITTED: "Soumise",
  PAID: "Payée",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursée",
  CREATED: "Créé",
  SUCCEEDED: "Réussi",
  FAILED: "Échoué",
  PAST_DUE: "En grâce",
  CANCEL_AT_PERIOD_END: "Résiliation à l'échéance",
  REQUESTED: "Demandé",
  PROCESSING: "En cours chez le prestataire",
  RECEIVED: "Reçu",
  APPLIED: "Appliqué",
  IGNORED: "Ignoré",
  SUBSCRIPTION_START: "Souscription",
  SUBSCRIPTION_RENEWAL: "Renouvellement",
  AMOUNT_MISMATCH: "Montant incohérent",
  UNKNOWN_REFERENCE: "Référence inconnue",
  DUPLICATE_PAYMENT: "Paiement en double",
  LATE_SUCCESS: "Succès tardif",
  GRANT_CONFLICT: "Conflit de droits",
  REFUND_FAILED: "Remboursement échoué",
  RETIRED: "Retiré",
}

/** Montant entier transmis en chaîne par l'API (jamais de flottant). */
export function formatMoney(
  amount: string | null | undefined,
  currency: string,
): string {
  if (amount === null || amount === undefined || !/^\d+$/.test(amount)) {
    return "—"
  }
  return `${number.format(BigInt(amount))} ${currency}`
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export const DECISION_LABELS: Record<string, string> = {
  APPROVE: "Valider et publier",
  REJECT: "Refuser",
  REQUEST_CHANGES: "Demander des corrections",
  SUSPEND: "Suspendre",
  RESTORE: "Republier",
}

export const ACCOUNT_DECISION_LABELS: Record<string, string> = {
  SUSPEND: "Suspendre le compte",
  BAN: "Bannir le compte",
  REACTIVATE: "Réactiver le compte",
}
