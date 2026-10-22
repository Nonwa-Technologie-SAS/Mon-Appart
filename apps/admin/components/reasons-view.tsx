"use client"

import { useId, useState, type FormEvent } from "react"

import { can } from "@/lib/permissions"
import type { ModerationReason } from "@/lib/types"
import { useMutation, useResource } from "@/lib/use-api"

import { useSession } from "./session-provider"
import {
  ActionError,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Section,
  inputClass,
} from "./ui"

const ACTION_LABELS: Record<ModerationReason["action"], string> = {
  REQUEST_CHANGES: "Demande de corrections",
  REJECT: "Refus",
  SUSPEND: "Suspension",
}

export function ReasonsView() {
  const {
    state: { me },
  } = useSession()
  const canManage = can(me, "settings:manage")
  const reasons = useResource<ModerationReason[]>("/admin/moderation-reasons", {
    includeInactive: canManage,
  })

  return (
    <>
      <PageHeader
        title="Motifs de modération"
        description="Motifs proposés lors des décisions sur les annonces. Le message est transmis à l'annonceur : aucun détail interne ni antifraude. Le code et le type sont immuables ; un motif se désactive, il ne se supprime pas."
      />
      {reasons.status === "loading" ? <Loading /> : null}
      {reasons.status === "error" ? (
        <ErrorState error={reasons.error} onRetry={reasons.reload} />
      ) : null}
      {reasons.status === "ready" ? (
        <div className="flex flex-col gap-4">
          {canManage ? <CreateReason onCreated={reasons.reload} /> : null}
          {reasons.data.length === 0 ? (
            <EmptyState>Aucun motif.</EmptyState>
          ) : (
            reasons.data.map((reason) => (
              <ReasonCard
                key={reason.code}
                reason={reason}
                canManage={canManage}
                onSaved={reasons.reload}
              />
            ))
          )}
        </div>
      ) : null}
    </>
  )
}

function ReasonCard({
  reason,
  canManage,
  onSaved,
}: {
  reason: ModerationReason
  canManage: boolean
  onSaved: () => void
}) {
  const id = useId()
  const mutation = useMutation()
  const [editing, setEditing] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await mutation.run(
      `/admin/moderation-reasons/${reason.code}`,
      {
        label: String(form.get("label") ?? "").trim(),
        ownerMessage: String(form.get("ownerMessage") ?? "").trim(),
        sortOrder: Number(form.get("sortOrder") ?? reason.sortOrder),
        isActive: form.get("isActive") === "on",
      },
      "PATCH",
    )
    if (result.ok) {
      setEditing(false)
      onSaved()
    }
  }

  return (
    <Section title={`${reason.code} · ${ACTION_LABELS[reason.action]}`}>
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Libellé" htmlFor={`${id}-label`}>
            <input
              id={`${id}-label`}
              name="label"
              required
              maxLength={120}
              defaultValue={reason.label}
              className={inputClass}
            />
          </Field>
          <Field label="Message à l'annonceur" htmlFor={`${id}-message`}>
            <textarea
              id={`${id}-message`}
              name="ownerMessage"
              required
              maxLength={500}
              rows={2}
              defaultValue={reason.ownerMessage}
              className={inputClass}
            />
          </Field>
          <Field label="Ordre d'affichage" htmlFor={`${id}-order`}>
            <input
              id={`${id}-order`}
              name="sortOrder"
              type="number"
              min={0}
              max={1000}
              defaultValue={reason.sortOrder}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={reason.isActive}
            />
            Actif
          </label>
          <ActionError error={mutation.error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.pending}>
              {mutation.pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={mutation.pending}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{reason.label}</span>
            <Badge
              value={reason.isActive ? "ACTIVE" : "INACTIVE"}
              label={reason.isActive ? "Actif" : "Inactif"}
            />
          </div>
          <p className="text-stone-700">« {reason.ownerMessage} »</p>
          {canManage ? (
            <div>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Modifier
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  )
}

function CreateReason({ onCreated }: { onCreated: () => void }) {
  const id = useId()
  const mutation = useMutation()
  const [open, setOpen] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await mutation.run("/admin/moderation-reasons", {
      code: String(form.get("code") ?? "")
        .trim()
        .toUpperCase(),
      action: String(form.get("action") ?? ""),
      label: String(form.get("label") ?? "").trim(),
      ownerMessage: String(form.get("ownerMessage") ?? "").trim(),
    })
    if (result.ok) {
      setOpen(false)
      onCreated()
    }
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Nouveau motif</Button>
      </div>
    )
  }

  return (
    <Section title="Nouveau motif">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Code"
          htmlFor={`${id}-code`}
          hint="Majuscules, chiffres et _ ; immuable."
        >
          <input
            id={`${id}-code`}
            name="code"
            required
            pattern="[A-Za-z][A-Za-z0-9_]{1,63}"
            className={inputClass}
          />
        </Field>
        <Field label="Type de décision" htmlFor={`${id}-action`}>
          <select
            id={`${id}-action`}
            name="action"
            required
            className={inputClass}
          >
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Libellé" htmlFor={`${id}-label`}>
          <input
            id={`${id}-label`}
            name="label"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="Message à l'annonceur" htmlFor={`${id}-message`}>
          <textarea
            id={`${id}-message`}
            name="ownerMessage"
            required
            maxLength={500}
            rows={2}
            className={inputClass}
          />
        </Field>
        <ActionError error={mutation.error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? "Création…" : "Créer"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={mutation.pending}
          >
            Annuler
          </Button>
        </div>
      </form>
    </Section>
  )
}
