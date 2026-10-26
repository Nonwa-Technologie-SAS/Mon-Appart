"use client"

import { useActionState, useState, useTransition } from "react"

import {
  confirmEmailVerification,
  confirmPhoneVerification,
  requestEmailVerification,
  requestPhoneVerification,
  type ContactVerifyState,
} from "@/app/actions/contact-verify"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initial: ContactVerifyState = {}

function ChannelVerify({
  label,
  verified,
  missingContact,
  onRequest,
  confirmAction,
}: {
  label: string
  verified: boolean
  missingContact: boolean
  onRequest: () => Promise<ContactVerifyState>
  confirmAction: (
    prev: ContactVerifyState,
    formData: FormData,
  ) => Promise<ContactVerifyState>
}) {
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [state, formAction, confirming] = useActionState(confirmAction, initial)

  if (verified) {
    return (
      <p className="text-sm text-success">
        {label} : vérifié
      </p>
    )
  }

  if (missingContact) {
    return (
      <p className="text-sm text-muted-foreground">
        {label} : non renseigné sur le compte.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setRequestError(null)
              const result = await onRequest()
              if (result.error) {
                setRequestError(result.error)
                return
              }
              setChallengeId(result.challengeId ?? null)
              setRequestMessage(result.message ?? "Code envoyé.")
            })
          }}
        >
          {pending ? "Envoi…" : "Recevoir un code"}
        </Button>
      </div>
      {requestError ? (
        <p className="text-sm text-destructive">{requestError}</p>
      ) : null}
      {requestMessage ? (
        <p className="text-xs text-muted-foreground">{requestMessage}</p>
      ) : null}
      {challengeId ? (
        <form action={formAction}>
          <input type="hidden" name="challengeId" value={challengeId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`code-${label}`}>Code reçu</FieldLabel>
              <Input
                id={`code-${label}`}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={4}
                maxLength={10}
                disabled={confirming}
                placeholder="123456"
              />
            </Field>
            {state.error ? <FieldError>{state.error}</FieldError> : null}
            {state.success ? (
              <p className="text-sm text-success">{state.message}</p>
            ) : null}
            <Button type="submit" size="sm" disabled={confirming}>
              {confirming ? "Vérification…" : "Confirmer"}
            </Button>
          </FieldGroup>
        </form>
      ) : null}
    </div>
  )
}

export function ContactVerifyPanel({
  emailVerified,
  phoneVerified,
  hasEmail,
  hasPhone,
}: {
  emailVerified: boolean
  phoneVerified: boolean
  hasEmail: boolean
  hasPhone: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <ChannelVerify
        label="E-mail"
        verified={emailVerified}
        missingContact={!hasEmail}
        onRequest={requestEmailVerification}
        confirmAction={confirmEmailVerification}
      />
      <ChannelVerify
        label="Téléphone"
        verified={phoneVerified}
        missingContact={!hasPhone}
        onRequest={requestPhoneVerification}
        confirmAction={confirmPhoneVerification}
      />
    </div>
  )
}
