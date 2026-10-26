"use client"

import { useActionState, useState } from "react"

import { sendListingMessage, type CrmActionState } from "@/app/actions/crm"
import { AuthRequiredCta } from "@/components/site/auth-required-cta"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { trackWebEvent } from "@/lib/analytics/tracker"

const initial: CrmActionState = {}

export function ListingContactMessageDialog({
  listingId,
  listingTitle,
  isAuthenticated,
}: {
  listingId: string
  listingTitle: string
  isAuthenticated: boolean
}) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && isAuthenticated) {
          trackWebEvent("listing_contact_started", {
            listingId,
            method: "FORM",
          })
        }
        if (!next) setFormKey((key) => key + 1)
      }}
    >
      <DialogTrigger
        render={
          <Button
            size="lg"
            variant="outline"
            className="min-h-11 w-full text-base"
          />
        }
      >
        Envoyer un message
      </DialogTrigger>
      <DialogContent>
        {isAuthenticated ? (
          <MessageForm
            key={formKey}
            listingId={listingId}
            listingTitle={listingTitle}
            onClose={() => setOpen(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Compte requis</DialogTitle>
              <DialogDescription>
                Connectez-vous pour écrire au responsable de « {listingTitle} ».
              </DialogDescription>
            </DialogHeader>
            <AuthRequiredCta
              nextPath={
                typeof window !== "undefined"
                  ? window.location.pathname
                  : `/annonces/${listingId}`
              }
              reason="L’inscription permet de suivre vos échanges en toute sécurité."
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MessageForm({
  listingId,
  listingTitle,
  onClose,
}: {
  listingId: string
  listingTitle: string
  onClose: () => void
}) {
  const [state, action, pending] = useActionState(sendListingMessage, initial)

  if (state.success) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Message envoyé</DialogTitle>
          <DialogDescription>
            Votre message pour « {listingTitle} » a été transmis. Le responsable
            vous répondra dans la conversation liée à l’annonce.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Contacter le responsable</DialogTitle>
        <DialogDescription>
          Décrivez votre besoin. N’indiquez pas de documents sensibles.
        </DialogDescription>
      </DialogHeader>
      <form action={action}>
        <input type="hidden" name="listingId" value={listingId} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="message">Message</FieldLabel>
            <Textarea
              id="message"
              name="message"
              required
              minLength={4}
              disabled={pending}
              placeholder="Bonjour, le bien est-il encore disponible ?"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="budgetAmount">
              Budget (FCFA, optionnel)
            </FieldLabel>
            <Input
              id="budgetAmount"
              name="budgetAmount"
              inputMode="numeric"
              disabled={pending}
              placeholder="Ex. 250000"
            />
            <FieldDescription>
              Un budget aide le responsable à vous répondre, sans preuve de
              solvabilité.
            </FieldDescription>
          </Field>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </FieldGroup>
      </form>
    </>
  )
}
