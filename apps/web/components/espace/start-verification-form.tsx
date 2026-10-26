"use client"

import { useActionState, useState } from "react"

import {
  startVerification,
  type VerificationActionState,
} from "@/app/actions/verifications"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { VerificationType } from "@/lib/nest-trust-shared"
import { Role } from "@/lib/domain-enums"

const initialState: VerificationActionState = {}

type PropertyOption = { propertyId: string; title: string }

export function StartVerificationForm({
  role,
  properties,
}: {
  role: string
  properties: PropertyOption[]
}) {
  const [state, formAction, pending] = useActionState(
    startVerification,
    initialState,
  )
  const [type, setType] = useState<VerificationType>("IDENTITY")
  const isAgency = role === Role.AGENCY
  const needsProperty =
    type === "PROPERTY_OWNERSHIP" ||
    type === "OWNER_AUTHORIZATION" ||
    type === "PROPERTY_DOCUMENT"

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="type">Type de dossier</FieldLabel>
          <select
            id="type"
            name="type"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={type}
            onChange={(event) =>
              setType(event.target.value as VerificationType)
            }
            disabled={pending}
          >
            <option value="IDENTITY">Identité (pièce d’identité)</option>
            {isAgency ? (
              <option value="AGENCY">Agence (RCCM / carte pro)</option>
            ) : null}
            <option value="PROPERTY_OWNERSHIP">Propriété d’un bien</option>
            <option value="OWNER_AUTHORIZATION">Mandat sur un bien</option>
            <option value="PROPERTY_DOCUMENT">Documents d’un bien</option>
          </select>
        </Field>

        {type === "AGENCY" ? (
          <Field>
            <FieldLabel htmlFor="agencyName">Raison sociale</FieldLabel>
            <Input
              id="agencyName"
              name="agencyName"
              required
              disabled={pending}
              placeholder="Immobilier Plateau SARL"
            />
          </Field>
        ) : null}

        {needsProperty ? (
          <Field>
            <FieldLabel htmlFor="propertyId">Bien concerné</FieldLabel>
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Publiez d’abord un bien pour ouvrir ce type de dossier.
              </p>
            ) : (
              <select
                id="propertyId"
                name="propertyId"
                required
                disabled={pending}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {properties.map((property) => (
                  <option key={property.propertyId} value={property.propertyId}>
                    {property.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}

        {type === "PROPERTY_OWNERSHIP" ? (
          <Field>
            <FieldLabel htmlFor="claimedRelation">Rattachement</FieldLabel>
            <select
              id="claimedRelation"
              name="claimedRelation"
              required
              disabled={pending}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              defaultValue="SOLE"
            >
              <option value="SOLE">Propriétaire unique</option>
              <option value="JOINT">Copropriété</option>
              <option value="USUFRUCT">Usufruit</option>
            </select>
          </Field>
        ) : null}

        {type === "OWNER_AUTHORIZATION" ? (
          <Field>
            <FieldLabel htmlFor="claimedRelation">Type de mandat</FieldLabel>
            <select
              id="claimedRelation"
              name="claimedRelation"
              required
              disabled={pending}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              defaultValue="AGENT"
            >
              <option value="AGENT">Agent</option>
              <option value="MANAGER">Gestionnaire</option>
            </select>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="statement">Précision (optionnel)</FieldLabel>
          <Input
            id="statement"
            name="statement"
            disabled={pending}
            maxLength={500}
            placeholder="Contexte libre — sans numéro de pièce"
          />
        </Field>

        {state.error ? <FieldError>{state.error}</FieldError> : null}

        <Button
          type="submit"
          disabled={pending || (needsProperty && properties.length === 0)}
          className="min-h-11 w-full sm:w-auto"
        >
          {pending ? "Ouverture…" : "Ouvrir le dossier"}
        </Button>
      </FieldGroup>
    </form>
  )
}
