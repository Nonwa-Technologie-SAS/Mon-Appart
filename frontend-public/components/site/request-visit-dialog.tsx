"use client"

import { useActionState, useState } from "react"

import {
  requestPropertyVisit,
  type VisitRequestState,
} from "@/app/actions/visits"
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

type RequestVisitDialogProps = {
  propertyId: string
  propertyTitle: string
}

const initialState: VisitRequestState = {}

function toDatetimeLocalMin(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function RequestVisitDialog({
  propertyId,
  propertyTitle,
}: RequestVisitDialogProps) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setFormKey((key) => key + 1)
        }
      }}
    >
      <DialogTrigger render={<Button size="lg" className="w-full" />}>
        Demander une visite
      </DialogTrigger>
      <DialogContent>
        <RequestVisitForm
          key={formKey}
          propertyId={propertyId}
          propertyTitle={propertyTitle}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function RequestVisitForm({
  propertyId,
  propertyTitle,
  onClose,
}: RequestVisitDialogProps & { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(
    requestPropertyVisit,
    initialState
  )
  const minVisitAt = toDatetimeLocalMin(new Date())

  if (state.success) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Demande envoyée</DialogTitle>
          <DialogDescription>
            Votre demande pour « {propertyTitle} » a bien été transmise.
            L&apos;agence vous contactera sur WhatsApp pour confirmer le
            créneau.
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
        <DialogTitle>Demander une visite</DialogTitle>
        <DialogDescription>
          Indiquez vos coordonnées et le créneau souhaité pour visiter «{" "}
          {propertyTitle} ».
        </DialogDescription>
      </DialogHeader>
      <form action={formAction}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <FieldGroup>
          <Field data-disabled={pending ? true : undefined}>
            <FieldLabel htmlFor="visitorName">Nom complet</FieldLabel>
            <Input
              id="visitorName"
              name="visitorName"
              autoComplete="name"
              required
              disabled={pending}
              placeholder="Marie Kouassi"
            />
          </Field>
          <Field data-disabled={pending ? true : undefined}>
            <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              disabled={pending}
              placeholder="07 00 00 00 00"
            />
            <FieldDescription>
              L&apos;agence vous écrira sur ce numéro pour confirmer.
            </FieldDescription>
          </Field>
          <Field data-disabled={pending ? true : undefined}>
            <FieldLabel htmlFor="visitorEmail">Email (optionnel)</FieldLabel>
            <Input
              id="visitorEmail"
              name="visitorEmail"
              type="email"
              autoComplete="email"
              disabled={pending}
              placeholder="marie@email.com"
            />
          </Field>
          <Field data-disabled={pending ? true : undefined}>
            <FieldLabel htmlFor="visitAt">Date et heure souhaitées</FieldLabel>
            <Input
              id="visitAt"
              name="visitAt"
              type="datetime-local"
              required
              min={minVisitAt}
              disabled={pending}
              className="max-w-full"
            />
          </Field>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              {pending ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </DialogFooter>
        </FieldGroup>
      </form>
    </>
  )
}
