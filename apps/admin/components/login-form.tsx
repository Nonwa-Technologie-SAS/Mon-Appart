"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"

import { ApiError } from "@/lib/api"

import { useSession } from "./session-provider"
import { Button, Field, inputClass } from "./ui"

const LOGIN_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Identifiant ou mot de passe incorrect.",
  ACCOUNT_SUSPENDED: "Ce compte est suspendu.",
  ACCOUNT_BANNED: "Ce compte est banni.",
  ACCOUNT_INACTIVE: "Ce compte est inactif.",
}

export function LoginForm() {
  const router = useRouter()
  const {
    state: { status },
    actions: { signIn, signOut },
  } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (status === "authenticated") router.replace("/")
  }, [status, router])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    try {
      await signIn(
        String(form.get("identifier") ?? ""),
        String(form.get("password") ?? ""),
      )
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 429
            ? "Trop de tentatives. Réessayez plus tard."
            : (LOGIN_MESSAGES[caught.code] ?? caught.message)
          : "Le service est injoignable.",
      )
    } finally {
      setPending(false)
    }
  }

  if (status === "forbidden") {
    return (
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-stone-600">
          Ce compte n&apos;a pas accès au back-office. Les droits sont attribués
          par un administrateur.
        </p>
        <Button className="mt-4" variant="secondary" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-lg font-semibold">Mon Appart — Back-office</h1>
        <p className="mt-1 text-sm text-stone-600">
          Réservé aux équipes habilitées.
        </p>
      </div>
      <Field label="E-mail ou téléphone" htmlFor="identifier">
        <input
          id="identifier"
          name="identifier"
          autoComplete="username"
          required
          maxLength={254}
          className={inputClass}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {status === "unavailable" ? (
        <p role="status" className="text-sm text-amber-800">
          Le service est momentanément injoignable.
        </p>
      ) : null}
      <Button type="submit" disabled={pending || status === "loading"}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  )
}
