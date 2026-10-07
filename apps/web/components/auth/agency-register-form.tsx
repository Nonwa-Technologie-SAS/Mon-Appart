"use client"

import { useActionState } from "react"
import Link from "next/link"

import {
  type AuthActionState,
  registerAgency,
} from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

const initialState: AuthActionState = {}

export function AgencyRegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAgency,
    initialState
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Inscription agence</CardTitle>
        <CardDescription>
          Créez le compte de votre agence immobilière.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="agencyName">Nom de l&apos;agence</FieldLabel>
              <Input
                id="agencyName"
                name="agencyName"
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="name">Responsable</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Téléphone</FieldLabel>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="address">Adresse</FieldLabel>
              <Input
                id="address"
                name="address"
                autoComplete="street-address"
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={pending}
              />
            </Field>
            {state.error ? <FieldError>{state.error}</FieldError> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Création…" : "Créer mon agence"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-wrap justify-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="ml-1 text-foreground underline">
          Se connecter
        </Link>
      </CardFooter>
    </Card>
  )
}
