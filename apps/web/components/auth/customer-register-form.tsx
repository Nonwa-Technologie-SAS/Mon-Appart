"use client"

import { useActionState } from "react"
import Link from "next/link"

import {
  type AuthActionState,
  registerCustomer,
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

export function CustomerRegisterForm({ next }: { next?: string | null }) {
  const [state, formAction, pending] = useActionState(
    registerCustomer,
    initialState,
  )

  const loginHref = next
    ? `/connexion?next=${encodeURIComponent(next)}`
    : "/connexion"

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Créer un compte</CardTitle>
        <CardDescription>
          Enregistrez des favoris et demandez des visites en quelques minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nom complet</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                disabled={pending}
                className="min-h-11"
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
                className="min-h-11"
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
                minLength={10}
                disabled={pending}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                Au moins 10 caractères.
              </p>
            </Field>
            {state.error ? <FieldError>{state.error}</FieldError> : null}
            <Button type="submit" disabled={pending} className="min-h-11 w-full">
              {pending ? "Création…" : "Créer mon compte"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Déjà un compte ?{" "}
          <Link href={loginHref} className="text-foreground underline">
            Se connecter
          </Link>
        </p>
        <p>
          Propriétaire ou agence ?{" "}
          <Link
            href="/inscription/proprietaire"
            className="text-foreground underline"
          >
            Publier un bien
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
