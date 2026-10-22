"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  deleteMyVerificationDocument,
  submitMyVerification,
  withdrawMyVerification,
} from "@/app/actions/verifications"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  DOCUMENT_TYPE_LABELS,
  type NestVerification,
  type VerificationDocumentType,
} from "@/lib/nest-trust-shared"

const EDITABLE = new Set(["DRAFT", "NEEDS_MORE_INFORMATION"])

export function VerificationDetailClient({
  verification,
}: {
  verification: NestVerification
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<VerificationDocumentType>(
    verification.requirements?.accepted[0] ?? "NATIONAL_ID",
  )
  const canEdit = EDITABLE.has(verification.status)
  const accepted = verification.requirements?.accepted ?? []

  async function onUpload(file: File | null) {
    if (!file) return
    setError(null)
    setMessage(null)
    const body = new FormData()
    body.set("documentType", documentType)
    body.set("file", file)
    const response = await fetch(
      `/api/trust/verifications/${verification.id}/documents`,
      { method: "POST", body },
    )
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    if (!response.ok) {
      setError(payload?.error ?? "Échec de l’envoi.")
      return
    }
    setMessage("Pièce envoyée.")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <h2 className="font-semibold">Ajouter une pièce</h2>
          <p className="text-sm text-muted-foreground">
            PDF, JPEG, PNG ou WebP. Une pièce envoyée ne vaut pas encore
            vérification : un agent examine le dossier.
          </p>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="documentType">Type de pièce</FieldLabel>
              <select
                id="documentType"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={documentType}
                onChange={(event) =>
                  setDocumentType(
                    event.target.value as VerificationDocumentType,
                  )
                }
                disabled={pending}
              >
                {accepted.map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type] ?? type}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="file">Fichier</FieldLabel>
              <input
                id="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={pending}
                className="block w-full text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  startTransition(() => {
                    void onUpload(file)
                  })
                  event.target.value = ""
                }}
              />
              <FieldDescription>Taille max. 12 Mo.</FieldDescription>
            </Field>
          </FieldGroup>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Pièces jointes</h2>
        {verification.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune pièce pour l’instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {verification.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType} ·{" "}
                  {doc.uploadStatus}
                </span>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await deleteMyVerificationDocument(
                          verification.id,
                          doc.id,
                        )
                        if (result.error) setError(result.error)
                        else router.refresh()
                      })
                    }}
                  >
                    Retirer
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {verification.requirements?.missing?.length ? (
          <p className="text-xs text-muted-foreground">
            Groupes encore manquants :{" "}
            {verification.requirements.missing
              .map((group) =>
                group.map((t) => DOCUMENT_TYPE_LABELS[t] ?? t).join(" / "),
              )
              .join(" · ")}
          </p>
        ) : null}
      </section>

      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setError(null)
                const result = await submitMyVerification(verification.id)
                if (result.error) setError(result.error)
                else {
                  setMessage("Dossier soumis pour examen.")
                  router.refresh()
                }
              })
            }}
          >
            Soumettre pour examen
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await withdrawMyVerification(verification.id)
                if (result.error) setError(result.error)
                else router.refresh()
              })
            }}
          >
            Retirer le dossier
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      {verification.history.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Historique</h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {verification.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                {new Date(entry.at).toLocaleString("fr-FR")} — {entry.status}
                {entry.reason ? ` · ${entry.reason.message}` : ""}
                {entry.message ? ` · ${entry.message}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
