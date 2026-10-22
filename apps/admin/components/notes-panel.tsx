"use client"

import { useId, useState, type FormEvent } from "react"

import { formatDateTime } from "@/lib/format"
import type { AdminNote } from "@/lib/types"
import { useMutation } from "@/lib/use-api"

import { ActionError, Button, EmptyState, Section, inputClass } from "./ui"

/** Notes internes : ajout seulement, jamais modifiables ni visibles du titulaire. */
export function NotesPanel({
  notes,
  postPath,
  canAdd,
  onAdded,
}: {
  notes: AdminNote[]
  postPath: string
  canAdd: boolean
  onAdded: () => void
}) {
  const id = useId()
  const [body, setBody] = useState("")
  const mutation = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await mutation.run(postPath, { body: body.trim() })
    if (result.ok) {
      setBody("")
      onAdded()
    }
  }

  return (
    <Section title="Notes internes">
      {notes.length === 0 ? (
        <EmptyState>Aucune note interne.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="border-l-2 border-stone-300 pl-3">
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <p className="mt-1 text-xs text-stone-500">
                {note.author?.name ?? "Auteur inconnu"} ·{" "}
                {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {canAdd ? (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Ajouter une note (non modifiable, jamais visible du titulaire)
          </label>
          <textarea
            id={`${id}-note`}
            rows={3}
            maxLength={2000}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={inputClass}
          />
          <ActionError error={mutation.error} />
          <div>
            <Button
              type="submit"
              disabled={mutation.pending || body.trim().length === 0}
            >
              {mutation.pending ? "Ajout…" : "Ajouter la note"}
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
  )
}
