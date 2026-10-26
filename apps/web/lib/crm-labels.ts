export const STAGE_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  VISIT_PLANNED: "Visite planifiée",
  VISIT_DONE: "Visite réalisée",
  FOLLOW_UP: "Suivi",
  CONVERTED: "Converti (déclaré)",
  LOST: "Perdu",
  ARCHIVED: "Archivé",
}

export const STAGE_OPTIONS = Object.keys(STAGE_LABELS)

export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Prioritaire",
  MEDIUM: "À traiter",
  LOW: "Standard",
}

export const LOST_REASON_LABELS: Record<string, string> = {
  BUDGET: "Budget",
  LOCATION: "Localisation",
  TIMING: "Délai",
  NO_RESPONSE: "Sans réponse",
  PROPERTY_UNAVAILABLE: "Bien indisponible",
  OTHER: "Autre",
}

export const VISIT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  RESCHEDULE_REQUESTED: "Nouvelle date proposée",
  CANCELLED: "Annulée",
  COMPLETED: "Réalisée",
  NO_SHOW: "Non honorée",
}

export const SYSTEM_MESSAGE_LABELS: Record<string, string> = {
  APPOINTMENT_REQUESTED: "Demande de visite enregistrée",
  APPOINTMENT_CONFIRMED: "Visite confirmée",
  APPOINTMENT_RESCHEDULE_PROPOSED: "Autre créneau proposé",
  APPOINTMENT_CANCELLED: "Visite annulée",
  APPOINTMENT_COMPLETED: "Visite marquée comme réalisée",
  APPOINTMENT_NO_SHOW: "Visite non honorée",
  CONVERSATION_CLOSED: "Conversation clôturée",
}

export function formatCiDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleString("fr-CI", {
    timeZone: "Africa/Abidjan",
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—"
  return `${Math.round(value * 100)} %`
}
