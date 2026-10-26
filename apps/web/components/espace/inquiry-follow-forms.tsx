"use client"

import { useActionState } from "react"

import {
  addInquiryNote,
  replyToConversation,
  updateInquiryFollowUp,
  updateInquiryStage,
  type CrmActionState,
} from "@/app/actions/crm"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  LOST_REASON_LABELS,
  STAGE_LABELS,
  STAGE_OPTIONS,
} from "@/lib/crm-labels"

const initial: CrmActionState = {}

const selectClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"

function toDatetimeLocalValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function InquiryStageForm({
  inquiryId,
  stage,
}: {
  inquiryId: string
  stage: string
}) {
  const [state, action, pending] = useActionState(updateInquiryStage, initial)
  return (
    <form action={action}>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="stage">Statut commercial</FieldLabel>
          <select
            id="stage"
            name="stage"
            defaultValue={stage}
            className={selectClass}
            disabled={pending}
          >
            {STAGE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STAGE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="lostReason">Motif si perdu</FieldLabel>
          <select
            id="lostReason"
            name="lostReason"
            defaultValue="OTHER"
            className={selectClass}
            disabled={pending}
          >
            {Object.entries(LOST_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldDescription>
            Obligatoire uniquement si vous passez à « Perdu ». Une conversion
            est une déclaration, pas une vente vérifiée.
          </FieldDescription>
        </Field>
        {state.error ? <FieldError>{state.error}</FieldError> : null}
        {state.success ? (
          <p className="text-sm text-success">Statut mis à jour.</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Mettre à jour le statut"}
        </Button>
      </FieldGroup>
    </form>
  )
}

export function InquiryFollowUpForm({
  inquiryId,
  nextAction,
  nextActionAt,
  budgetAmount,
  desiredZone,
}: {
  inquiryId: string
  nextAction: string | null
  nextActionAt: string | null
  budgetAmount: number | null
  desiredZone: string | null
}) {
  const [state, action, pending] = useActionState(
    updateInquiryFollowUp,
    initial,
  )
  const nextLocal = nextActionAt ? toDatetimeLocalValue(nextActionAt) : ""
  return (
    <form action={action}>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nextAction">Prochaine action</FieldLabel>
          <Input
            id="nextAction"
            name="nextAction"
            defaultValue={nextAction ?? ""}
            disabled={pending}
            placeholder="Relancer, proposer une visite…"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="nextActionAt">Échéance</FieldLabel>
          <Input
            id="nextActionAt"
            name="nextActionAt"
            type="datetime-local"
            defaultValue={nextLocal}
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="budgetAmount">Budget déclaré (FCFA)</FieldLabel>
          <Input
            id="budgetAmount"
            name="budgetAmount"
            inputMode="numeric"
            defaultValue={budgetAmount ?? ""}
            disabled={pending}
            placeholder="Montant indiqué par le prospect"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="desiredZone">Zone souhaitée</FieldLabel>
          <Input
            id="desiredZone"
            name="desiredZone"
            defaultValue={desiredZone ?? ""}
            disabled={pending}
            placeholder="Cocody, Yopougon…"
          />
        </Field>
        {state.error ? <FieldError>{state.error}</FieldError> : null}
        {state.success ? (
          <p className="text-sm text-success">Suivi enregistré.</p>
        ) : null}
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le suivi"}
        </Button>
      </FieldGroup>
    </form>
  )
}

export function InquiryNoteForm({ inquiryId }: { inquiryId: string }) {
  const [state, action, pending] = useActionState(addInquiryNote, initial)
  return (
    <form action={action}>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="body">Note interne</FieldLabel>
          <Textarea
            id="body"
            name="body"
            required
            minLength={2}
            disabled={pending}
            placeholder="Visible uniquement de votre équipe, jamais du prospect."
          />
        </Field>
        {state.error ? <FieldError>{state.error}</FieldError> : null}
        {state.success ? (
          <p className="text-sm text-success">Note enregistrée.</p>
        ) : null}
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Enregistrement…" : "Ajouter une note"}
        </Button>
      </FieldGroup>
    </form>
  )
}

export function ConversationReplyForm({
  conversationId,
  inquiryId,
}: {
  conversationId: string
  inquiryId: string
}) {
  const [state, action, pending] = useActionState(replyToConversation, initial)
  return (
    <form action={action}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reply">Répondre au prospect</FieldLabel>
          <Textarea
            id="reply"
            name="body"
            required
            disabled={pending}
            placeholder="Ce message est visible du prospect. Ne collez pas une note interne."
          />
        </Field>
        {state.error ? <FieldError>{state.error}</FieldError> : null}
        {state.success ? (
          <p className="text-sm text-success">Message envoyé.</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      </FieldGroup>
    </form>
  )
}
