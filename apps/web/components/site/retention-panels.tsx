"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import {
  deleteSavedSearch,
  resumeSavedSearch,
  submitVisitFeedback,
  updateNotificationPreferences,
  updateProjectStatus,
  updateSavedSearchAlerts,
  type RetentionActionState,
} from "@/app/actions/retention"
import { Button } from "@/components/ui/button"
import type { NestSavedSearch } from "@/lib/nest-saved-searches"
import type { NestPreferenceCell } from "@/lib/nest-notification-preferences"

const initial: RetentionActionState = {}

const OUTCOMES: Array<[string, string]> = [
  ["PENDING_DECISION", "Je réfléchis encore"],
  ["STILL_INTERESTED", "Je souhaite poursuivre"],
  ["NEED_INFO", "J’ai besoin d’informations"],
  ["WANT_ANOTHER_VISIT", "Je veux une autre visite"],
  ["NOT_A_FIT", "Le bien ne correspond pas"],
  ["UNAVAILABLE", "Le bien n’est plus disponible"],
  ["PROJECT_ABANDONED", "Je mets ma recherche en pause"],
  ["PROJECT_COMPLETED", "J’ai trouvé (projet terminé)"],
]

const REASONS: Array<[string, string]> = [
  ["PRICE", "Prix trop élevé"],
  ["LOCATION", "Zone inadaptée"],
  ["SURFACE", "Surface insuffisante"],
  ["FEATURES", "Caractéristiques manquantes"],
  ["UNAVAILABLE", "Bien indisponible"],
  ["OTHER", "Autre"],
]

const CATEGORY_LABELS: Record<string, string> = {
  MESSAGES: "Conversations",
  VISITS: "Visites",
  APPOINTMENT_REMINDERS: "Rappels de visite",
  RECOMMENDATIONS: "Recommandations",
  PRICE_DROPS: "Baisse de prix des favoris",
  SAVED_SEARCHES: "Alertes de recherche",
  LISTING_UPDATES: "Suivi des annonces",
  ACCOUNT: "Compte et sécurité",
  MARKETING: "Communications promotionnelles",
}

export function SavedSearchActions({ search }: { search: NestSavedSearch }) {
  const router = useRouter()
  const [resumeState, resumeAction, resumePending] = useActionState(
    resumeSavedSearch,
    initial,
  )
  const [alertState, alertAction, alertPending] = useActionState(
    updateSavedSearchAlerts,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSavedSearch,
    initial,
  )

  useEffect(() => {
    if (resumeState.success && resumeState.resumePath) {
      router.push(resumeState.resumePath)
    }
  }, [resumeState, router])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={resumeAction}>
          <input type="hidden" name="savedSearchId" value={search.id} />
          <Button type="submit" size="sm" disabled={resumePending}>
            {resumePending ? "…" : "Reprendre"}
          </Button>
        </form>
        <form action={alertAction}>
          <input type="hidden" name="savedSearchId" value={search.id} />
          <input
            type="hidden"
            name="alertsEnabled"
            value={search.alertsEnabled ? "false" : "true"}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={alertPending}
          >
            {search.alertsEnabled
              ? "Mettre les alertes en pause"
              : "Réactiver les alertes"}
          </Button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="savedSearchId" value={search.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={deletePending}
          >
            Supprimer
          </Button>
        </form>
      </div>
      {alertState.error || deleteState.error || resumeState.error ? (
        <p className="text-xs text-destructive" role="status">
          {alertState.error || deleteState.error || resumeState.error}
        </p>
      ) : null}
    </div>
  )
}

export function ProjectStatusForm({
  projectStatus,
}: {
  projectStatus: string
}) {
  const [state, action, pending] = useActionState(updateProjectStatus, initial)
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm" htmlFor="projectStatus">
        État de votre projet
      </label>
      <select
        id="projectStatus"
        name="projectStatus"
        defaultValue={projectStatus}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm"
      >
        <option value="ACTIVE">Recherche en cours</option>
        <option value="PAUSED">Recherche en pause</option>
        <option value="COMPLETED">Projet terminé</option>
      </select>
      <p className="text-xs text-muted-foreground">
        Déclarer un projet terminé arrête les alertes de recherche. Une simple
        baisse d’activité ne le fait jamais automatiquement.
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
      {state.success ? (
        <p className="text-xs text-muted-foreground">Statut mis à jour.</p>
      ) : null}
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  )
}

export function VisitFeedbackForm({
  appointmentId,
}: {
  appointmentId: string
}) {
  const [state, action, pending] = useActionState(submitVisitFeedback, initial)
  return (
    <form
      action={action}
      className="mt-3 flex flex-col gap-2 border-t border-border pt-3"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <p className="text-sm font-medium">Retour facultatif</p>
      <label className="text-xs" htmlFor={`outcome-${appointmentId}`}>
        Suite à donner
      </label>
      <select
        id={`outcome-${appointmentId}`}
        name="outcome"
        required
        className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        defaultValue="PENDING_DECISION"
      >
        {OUTCOMES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="text-xs" htmlFor={`reason-${appointmentId}`}>
        Motif (optionnel)
      </label>
      <select
        id={`reason-${appointmentId}`}
        name="reason"
        className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        defaultValue=""
      >
        <option value="">Ne pas préciser</option>
        {REASONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="text-xs" htmlFor={`note-${appointmentId}`}>
        Note privée (jamais transmise au propriétaire)
      </label>
      <textarea
        id={`note-${appointmentId}`}
        name="privateNote"
        maxLength={1000}
        rows={2}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="shareOutcomeWithOwner" value="true" />
        Partager uniquement le résultat (pas la note) avec l’annonceur
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Envoi…" : "Enregistrer mon retour"}
      </Button>
      {state.success ? (
        <p className="text-xs text-muted-foreground">
          Retour enregistré. Merci.
        </p>
      ) : null}
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  )
}

export function NotificationPreferencesForm({
  cells,
}: {
  cells: NestPreferenceCell[]
}) {
  const [state, action, pending] = useActionState(
    updateNotificationPreferences,
    initial,
  )
  const categories = [...new Set(cells.map((cell) => cell.category))]
  const channels = ["EMAIL", "SMS", "PUSH"] as const

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Les messages nécessaires au service (compte, visites demandées) restent
        actifs. Le marketing est désactivé par défaut.
      </p>
      {categories.map((category) => (
        <fieldset
          key={category}
          className="rounded-lg border border-border p-3"
        >
          <legend className="px-1 text-sm font-medium">
            {CATEGORY_LABELS[category] ?? category}
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {channels.map((channel) => {
              const cell = cells.find(
                (item) =>
                  item.category === category && item.channel === channel,
              )
              if (!cell) return null
              const name = `pref:${category}:${channel}`
              return (
                <label
                  key={channel}
                  className="flex items-center gap-2 text-sm"
                >
                  <input type="hidden" name={name} value="false" />
                  <input
                    type="checkbox"
                    name={name}
                    value="true"
                    defaultChecked={cell.enabled}
                    disabled={cell.locked || !cell.available}
                  />
                  <span>
                    {channel}
                    {!cell.available ? " (non configuré)" : ""}
                    {cell.locked ? " (nécessaire)" : ""}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer les préférences"}
      </Button>
      {state.success ? (
        <p className="text-xs text-muted-foreground">
          Préférences enregistrées.
        </p>
      ) : null}
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  )
}
