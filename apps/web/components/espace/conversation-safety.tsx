"use client"

import { useActionState } from "react"

import { reportConversation, type TrustActionState } from "@/app/actions/trust"
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
    label: "Demande de paiement suspecte, phishing ou faux support",
  },
  {
    value: "MISLEADING_INFORMATION",
    label: "Informations trompeuses",
  },
  { value: "INAPPROPRIATE_CONTENT", label: "Comportement abusif" },
  { value: "OTHER", label: "Autre motif" },
]

export function ConversationSafetyBanner({
  messages,
}: {
  messages: Array<{
    userMessage: string
    severity: string
  }>
}) {
  if (messages.length === 0) return null
  return (
    <aside className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-medium">Avertissement de conversation</p>
      <ul className="mt-1 list-disc pl-5">
        {messages.map((item) => (
          <li key={item.userMessage}>{item.userMessage}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        Il s’agit d’une alerte préventive, pas d’une preuve de fraude.
      </p>
    </aside>
  )
}

export function ConversationReportForm({
  conversationId,
  inquiryId,
}: {
  conversationId: string
  inquiryId: string
}) {
  const [state, action, pending] = useActionState(reportConversation, initial)
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Signaler cette conversation
      </summary>
      <form action={action} className="mt-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="inquiryId" value={inquiryId} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="conversation-report-reason">Motif</FieldLabel>
            <select
              id="conversation-report-reason"
              name="reason"
              required
              defaultValue=""
              disabled={pending}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
            <FieldLabel htmlFor="conversation-report-description">
              Précisions (facultatif)
            </FieldLabel>
            <Textarea
              id="conversation-report-description"
              name="description"
              maxLength={1000}
              disabled={pending}
            />
            <FieldDescription>
              Le modérateur ne verra qu’un extrait borné, pas toute l’historique
              privée.
            </FieldDescription>
          </Field>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          {state.success ? (
            <p className="text-sm text-success">Signalement enregistré.</p>
          ) : null}
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Envoi…" : "Signaler"}
          </Button>
        </FieldGroup>
      </form>
    </details>
  )
}
