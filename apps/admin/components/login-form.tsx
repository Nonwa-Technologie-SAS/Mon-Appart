"use client"

import { Eye, EyeOff, LogIn } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"

import { ApiError } from "@/lib/api"

import { BrandMark } from "./brand-mark"
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
  const [showPassword, setShowPassword] = useState(false)

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
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-md">
        <BrandMark href="/login" size="login" />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Accès refusé</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ce compte n&apos;a pas accès au back-office. Les droits sont attribués
          par un administrateur.
        </p>
        <Button className="mt-5" variant="secondary" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-border bg-card p-7 shadow-md"
    >
      <div>
        <BrandMark href="/login" size="login" />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Back-office</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputClass} w-full pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-pressed={showPassword}
            aria-label={
              showPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        </div>
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status === "unavailable" ? (
        <p role="status" className="text-sm text-warning">
          Le service est momentanément injoignable.
        </p>
      ) : null}
      <Button
        type="submit"
        className="gap-2"
        disabled={pending || status === "loading"}
      >
        <LogIn aria-hidden className="size-4" />
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  )
}
