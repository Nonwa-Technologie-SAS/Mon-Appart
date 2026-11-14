"use client"

import { useId, useState, type FormEvent, type ReactNode } from "react"

import type { ApiError } from "@/lib/api"

import { ActionError, Button, Field, inputClass } from "./ui"

/**
 * Action sensible : ouvre un formulaire, exige une justification et une
 * confirmation explicite avant l'appel. Le serveur refait tous les contrôles.
 */
export function ReasonedAction({
  label,
  description,
  variant = "secondary",
  reasonLabel = "Justification (obligatoire, interne)",
  minLength = 3,
  maxLength = 500,
  pending,
  error,
  onSubmit,
  children,
}: {
  label: string
  description?: string
  variant?: "primary" | "secondary" | "danger"
  reasonLabel?: string
  minLength?: number
  maxLength?: number
  pending: boolean
  error: ApiError | null
  onSubmit: (reason: string) => Promise<boolean>
  children?: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await onSubmit(reason.trim())) {
      setReason("")
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-3 rounded-md border border-border bg-muted/60 p-3"
    >
      <p className="text-sm font-medium">{label}</p>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children}
      <Field label={reasonLabel} htmlFor={`${id}-reason`}>
        <textarea
          id={`${id}-reason`}
          required
          minLength={minLength}
          maxLength={maxLength}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={inputClass}
        />
      </Field>
      <ActionError error={error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={variant === "secondary" ? "primary" : variant}
          disabled={pending || reason.trim().length < minLength}
        >
          {pending ? "Envoi…" : "Confirmer"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
