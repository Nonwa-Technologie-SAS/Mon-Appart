"use client"

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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-stone-600">{description}</p>
        ) : null}
      </div>
      {children}
    </header>
  )
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-sm text-stone-500">
      {label}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-stone-300 bg-white/60 px-4 py-10 text-center text-sm text-stone-600">
      {children}
    </p>
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
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900"
    >
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
      {onRetry && !forbidden && error.status !== 404 ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
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
    <p role="alert" className="mt-2 text-sm text-red-700">
      {conflict
        ? `${error.message} Rechargez la page pour voir l'état actuel.`
        : error.status === 429
          ? "Trop d'actions en peu de temps. Patientez une minute."
          : error.message}
    </p>
  )
}

const BUTTON_VARIANTS = {
  primary: "bg-stone-900 text-white hover:bg-stone-700",
  secondary:
    "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
  danger: "bg-red-700 text-white hover:bg-red-600",
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
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  )
}

const TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  VERIFIED: "bg-emerald-100 text-emerald-900",
  PASS: "bg-emerald-100 text-emerald-900",
  SUSPENDED: "bg-amber-100 text-amber-900",
  PENDING_REVIEW: "bg-sky-100 text-sky-900",
  IN_REVIEW: "bg-sky-100 text-sky-900",
  OPEN: "bg-sky-100 text-sky-900",
  WARN: "bg-amber-100 text-amber-900",
  HIGH: "bg-red-100 text-red-900",
  CRITICAL: "bg-red-100 text-red-900",
  BANNED: "bg-red-100 text-red-900",
  REJECTED: "bg-red-100 text-red-900",
  PAID: "bg-emerald-100 text-emerald-900",
  SUCCEEDED: "bg-emerald-100 text-emerald-900",
  FAILED: "bg-red-100 text-red-900",
  PAST_DUE: "bg-amber-100 text-amber-900",
  PROCESSING: "bg-sky-100 text-sky-900",
  REQUESTED: "bg-sky-100 text-sky-900",
}

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONES[value] ?? "bg-stone-200 text-stone-800"}`}
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
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-600">
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
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:outline-2 focus:outline-stone-900"

/** Tableau responsive avec en-têtes accessibles. */
export function Table({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-600">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  )
}
