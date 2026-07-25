"use client"

import { useActionState } from "react"
import Link from "next/link"

import { type AuthActionState, signIn } from "@/app/actions/auth"
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

export function SignInForm({ registered }: { registered?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, initialState)

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>
          Accédez à votre espace immobilier.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            {registered ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                Compte créé. Vous pouvez vous connecter.
              </p>
            ) : null}
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
                autoComplete="current-password"
                required
                disabled={pending}
              />
            </Field>
            {state.error ? <FieldError>{state.error}</FieldError> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Connexion…" : "Se connecter"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Propriétaire ?{" "}
          <Link
            href="/inscription/proprietaire"
            className="text-foreground underline"
          >
            S&apos;inscrire
          </Link>
        </p>
        <p>
          Agence ?{" "}
          <Link href="/inscription/agence" className="text-foreground underline">
            Créer une agence
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
