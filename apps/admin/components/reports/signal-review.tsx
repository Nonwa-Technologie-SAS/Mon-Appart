"use client"

import { useId, useState, type FormEvent } from "react"

import { useMutation } from "@/lib/use-api"

import { ActionError, Button, inputClass } from "../ui"

/** Confirmer ou écarter une alerte : sans effet automatique sur la cible. */
export function SignalReview({
  signalId,
  onDone,
}: {
  signalId: string
  onDone: () => void
}) {
  const id = useId()
  const mutation = useMutation()
  const [outcome, setOutcome] = useState<"CONFIRMED" | "DISMISSED" | null>(null)
  const [note, setNote] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!outcome) return
    const result = await mutation.run(
      `/admin/trust/signals/${signalId}/review`,
      { outcome, ...(note.trim() ? { note: note.trim() } : {}) },
    )
    if (result.ok) onDone()
  }

  if (!outcome) {
    return (
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setOutcome("CONFIRMED")}>
          Confirmer l&apos;alerte
        </Button>
        <Button variant="secondary" onClick={() => setOutcome("DISMISSED")}>
          Écarter l&apos;alerte
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <p className="text-sm font-medium">
        {outcome === "CONFIRMED" ? "Confirmer l'alerte" : "Écarter l'alerte"}{" "}
        <span className="text-xs font-normal text-stone-500">
          (aucune sanction automatique)
        </span>
      </p>
      <label htmlFor={`${id}-note`} className="text-sm">
        Note interne (facultative)
      </label>
      <textarea
        id={`${id}-note`}
        rows={2}
        maxLength={2000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className={inputClass}
      />
      <ActionError error={mutation.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.pending}>
          {mutation.pending ? "Envoi…" : "Valider"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setOutcome(null)}
          disabled={mutation.pending}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
