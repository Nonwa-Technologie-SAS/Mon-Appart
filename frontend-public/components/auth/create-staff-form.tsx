"use client"

import { useActionState } from "react"

import {
  type AuthActionState,
  createStaffUser,
} from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

const initialState: AuthActionState = {}

export function CreateStaffForm() {
  const [state, formAction, pending] = useActionState(
    createStaffUser,
    initialState
  )

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Nouvel administrateur</CardTitle>
        <CardDescription>
          Réservé aux super administrateurs. Crée un ADMIN ou SUPERADMIN.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            {state.success ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                Utilisateur créé avec succès.
              </p>
            ) : null}
            <Field>
              <FieldLabel htmlFor="name">Nom</FieldLabel>
              <Input id="name" name="name" required disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="role">Rôle</FieldLabel>
              <NativeSelect id="role" name="role" required disabled={pending}>
                <option value="ADMIN">Administrateur</option>
                <option value="SUPERADMIN">Super administrateur</option>
              </NativeSelect>
            </Field>
            {state.error ? <FieldError>{state.error}</FieldError> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Création…" : "Créer l'utilisateur"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
