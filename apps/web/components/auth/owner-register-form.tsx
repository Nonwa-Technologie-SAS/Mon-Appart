"use client"

import { useActionState } from "react"
import Link from "next/link"

import {
  type AuthActionState,
  registerOwner,
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

export function OwnerRegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerOwner,
    initialState
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Inscription propriétaire</CardTitle>
        <CardDescription>
          Créez un compte pour publier et gérer vos biens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nom complet</FieldLabel>
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
              {pending ? "Création…" : "Créer mon compte"}
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
