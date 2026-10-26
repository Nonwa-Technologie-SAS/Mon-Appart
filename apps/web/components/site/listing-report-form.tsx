"use client"

import { useActionState } from "react"

import { reportListing, type TrustActionState } from "@/app/actions/trust"
import { AuthRequiredCta } from "@/components/site/auth-required-cta"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

const initial: TrustActionState = {}

const REASONS: Array<{ value: string; label: string }> = [
  {
    value: "SUSPECTED_SCAM",
    label: "Annonce potentiellement fausse ou arnaque",
  },
  {
    value: "MISLEADING_INFORMATION",
    label: "Bien inexistant ou informations trompeuses",
  },
  {
    value: "DUPLICATE_LISTING",
    label: "Photos ou annonce réutilisées de façon suspecte",
  },
  { value: "INCORRECT_PRICE", label: "Prix ou conditions trompeurs" },
  {
    value: "PROPERTY_NOT_AVAILABLE",
    label: "Bien déjà loué, vendu ou indisponible",
  },
  {
    value: "UNAUTHORIZED_LISTING",
    label: "Usurpation ou publication sans autorisation",
  },
  { value: "INAPPROPRIATE_CONTENT", label: "Contenu abusif ou inapproprié" },
  { value: "OTHER", label: "Autre motif" },
]

export function ListingReportForm({
  listingId,
  isAuthenticated,
  returnPath,
}: {
  listingId: string
  isAuthenticated: boolean
  returnPath: string
}) {
  const [state, action, pending] = useActionState(reportListing, initial)

  return (
    <details
      id="signaler"
      className="rounded-xl border border-border bg-card p-4"
    >
      <summary className="cursor-pointer text-sm font-medium">
        Signaler cette annonce
      </summary>
      <div className="mt-3">
        {!isAuthenticated ? (
          <AuthRequiredCta
            nextPath={returnPath}
            reason="Un compte est nécessaire pour déposer un signalement. Il sera examiné par un modérateur, sans sanction automatique."
          />
        ) : (
          <form action={action}>
            <input type="hidden" name="listingId" value={listingId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="listing-report-reason">Motif</FieldLabel>
                <select
                  id="listing-report-reason"
                  name="reason"
                  required
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  disabled={pending}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choisir un motif
                  </option>
                  {REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="listing-report-description">
                  Précisions (facultatif)
                </FieldLabel>
                <Textarea
                  id="listing-report-description"
                  name="description"
                  maxLength={1000}
                  disabled={pending}
                  placeholder="Décrivez uniquement les faits observables, sans données bancaires ni documents d’identité."
                />
                <FieldDescription>
                  Un signalement est une allégation à examiner, pas une preuve.
                </FieldDescription>
              </Field>
              {state.error ? <FieldError>{state.error}</FieldError> : null}
              {state.success ? (
                <p className="text-sm text-success">
                  Signalement enregistré. Merci, un modérateur l’examinera.
                </p>
              ) : null}
              <Button type="submit" variant="outline" disabled={pending}>
                {pending ? "Envoi…" : "Envoyer le signalement"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </div>
    </details>
  )
}
