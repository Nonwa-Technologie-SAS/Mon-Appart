"use client"

import { useActionState } from "react"

import { actOnVisit, type CrmActionState } from "@/app/actions/crm"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { NestAppointmentItem } from "@/lib/nest-appointments"

const initial: CrmActionState = {}

const CANCEL_REASONS = [
  ["SCHEDULE_CONFLICT", "Conflit d’horaire"],
  ["NO_LONGER_INTERESTED", "Plus intéressé"],
  ["PROPERTY_UNAVAILABLE", "Bien indisponible"],
  ["OTHER", "Autre"],
] as const

function ActionButton({
  appointmentId,
  action,
  label,
  variant = "outline",
}: {
  appointmentId: string
  action: string
  label: string
  variant?: "outline" | "default"
}) {
  const [state, formAction, pending] = useActionState(actOnVisit, initial)
  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="action" value={action} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  )
}

export function VisitActions({ visit }: { visit: NestAppointmentItem }) {
  const actions = new Set(visit.actions ?? [])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.has("CONFIRM") ? (
          <ActionButton
            appointmentId={visit.id}
            action="CONFIRM"
            label="Confirmer"
            variant="default"
          />
        ) : null}
        {actions.has("COMPLETE") ? (
          <ActionButton
            appointmentId={visit.id}
            action="COMPLETE"
            label="Marquer réalisée"
          />
        ) : null}
        {actions.has("NO_SHOW") ? (
          <ActionButton
            appointmentId={visit.id}
            action="NO_SHOW"
            label="Non honorée"
          />
        ) : null}
      </div>
      {actions.has("RESCHEDULE") ? (
        <RescheduleForm appointmentId={visit.id} />
      ) : null}
      {actions.has("CANCEL") ? <CancelForm appointmentId={visit.id} /> : null}
    </div>
  )
}

function RescheduleForm({ appointmentId }: { appointmentId: string }) {
  const [state, action, pending] = useActionState(actOnVisit, initial)
  return (
    <form
      action={action}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="action" value="RESCHEDULE" />
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor={`reschedule-${appointmentId}`}>
          Proposer un autre créneau
        </FieldLabel>
        <Input
          id={`reschedule-${appointmentId}`}
          name="scheduledAt"
          type="datetime-local"
          required
          disabled={pending}
        />
      </Field>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Proposer"}
      </Button>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  )
}

function CancelForm({ appointmentId }: { appointmentId: string }) {
  const [state, action, pending] = useActionState(actOnVisit, initial)
  return (
    <form
      action={action}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="action" value="CANCEL" />
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor={`cancel-${appointmentId}`}>Annuler</FieldLabel>
        <select
          id={`cancel-${appointmentId}`}
          name="reason"
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue="OTHER"
          disabled={pending}
        >
          {CANCEL_REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {pending ? "…" : "Annuler la visite"}
      </Button>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  )
}
