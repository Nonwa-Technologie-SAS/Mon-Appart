"use client"

import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"

import type { ApiError } from "@/lib/api"
import { statusLabel } from "@/lib/format"

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Mon Appart
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </header>
  )
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <p
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground"
    >
      <LoaderCircle aria-hidden className="size-5 animate-spin text-primary" />
      {label}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/70 px-6 py-14 text-center shadow-sm">
      <Inbox
        aria-hidden
        className="mx-auto mb-3 size-8 text-muted-foreground/70"
        strokeWidth={1.5}
      />
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError
  onRetry?: () => void
}) {
  const forbidden = error.status === 403
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            {forbidden
              ? "Vous n'avez pas la permission d'accéder à cette ressource."
              : error.status === 404
                ? "Élément introuvable."
                : error.message}
          </p>
          {error.requestId ? (
            <p className="mt-1 text-xs text-red-700">
              Référence : {error.requestId}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry && !forbidden && error.status !== 404 ? (
        <Button variant="secondary" className="mt-3 gap-2" onClick={onRetry}>
          <RefreshCw aria-hidden className="size-3.5" />
          Réessayer
        </Button>
      ) : null}
    </div>
  )
}

/** Erreur d'une action, avec message dédié au conflit de version. */
export function ActionError({ error }: { error: ApiError | null }) {
  if (!error) return null
  const conflict = error.status === 409
  return (
    <p role="alert" className="mt-2 text-sm text-destructive">
      {conflict
        ? `${error.message} Rechargez la page pour voir l'état actuel.`
        : error.status === 429
          ? "Trop d'actions en peu de temps. Patientez une minute."
          : error.message}
    </p>
  )
}

const BUTTON_VARIANTS = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
  secondary: "border border-border bg-card text-foreground hover:bg-muted",
  danger: "bg-destructive text-white hover:bg-red-700",
} as const

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  )
}

const TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  VERIFIED: "bg-emerald-100 text-emerald-900",
  PASS: "bg-emerald-100 text-emerald-900",
  SUSPENDED: "bg-amber-100 text-amber-950",
  PENDING_REVIEW: "bg-accent text-accent-foreground",
  IN_REVIEW: "bg-accent text-accent-foreground",
  OPEN: "bg-accent text-accent-foreground",
  WARN: "bg-amber-100 text-amber-950",
  HIGH: "bg-red-100 text-red-900",
  CRITICAL: "bg-red-100 text-red-900",
  BANNED: "bg-red-100 text-red-900",
  REJECTED: "bg-red-100 text-red-900",
  PAID: "bg-emerald-100 text-emerald-900",
  SUCCEEDED: "bg-emerald-100 text-emerald-900",
  FAILED: "bg-red-100 text-red-900",
  PAST_DUE: "bg-amber-100 text-amber-950",
  PROCESSING: "bg-accent text-accent-foreground",
  REQUESTED: "bg-accent text-accent-foreground",
}

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[value] ?? "bg-muted text-muted-foreground"}`}
    >
      {label ?? statusLabel(value)}
    </span>
  )
}

export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function LoadMore({
  hasMore,
  loading,
  error,
  onClick,
}: {
  hasMore: boolean
  loading: boolean
  error: ApiError | null
  onClick: () => void
}) {
  if (!hasMore) return null
  return (
    <div className="mt-4 flex flex-col items-center">
      <Button variant="secondary" onClick={onClick} disabled={loading}>
        {loading ? "Chargement…" : "Charger plus"}
      </Button>
      <ActionError error={error} />
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  "rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"

/** Tableau responsive avec en-têtes accessibles. */
export function Table({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-3.5 py-2.5 font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">{children}</tbody>
      </table>
    </div>
  )
}
