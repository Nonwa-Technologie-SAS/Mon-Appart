"use client"

import Link from "next/link"
import { useId, useState, type FormEvent } from "react"

import { formatDateTime, statusLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import type { ReportItem } from "@/lib/types"
import { useMutation, useResource } from "@/lib/use-api"

import { useSession } from "../session-provider"
import {
  ActionError,
  Badge,
  Button,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Section,
  inputClass,
} from "../ui"

const OPEN = new Set(["OPEN", "IN_REVIEW"])

const ACTION_LABELS: Record<string, string> = {
  NONE: "Aucune mesure",
  LISTING_SUSPENDED: "Suspendre l'annonce (workflow des annonces)",
  VERIFICATION_REVIEW_REQUESTED: "Demander un réexamen de vérification",
  CONVERSATION_CLOSED: "Fermer la conversation",
}

/** Mesures proposées selon la cible ; l'API revalide chacune. */
export function actionsFor(
  targetType: string,
  canSuspendListing: boolean,
): string[] {
  switch (targetType) {
    case "LISTING":
      return [
        "NONE",
        ...(canSuspendListing ? ["LISTING_SUSPENDED"] : []),
        "VERIFICATION_REVIEW_REQUESTED",
      ]
    case "USER":
      return ["NONE", "VERIFICATION_REVIEW_REQUESTED"]
    case "MESSAGE":
    case "CONVERSATION":
      return ["NONE", "CONVERSATION_CLOSED"]
    default:
      return ["NONE"]
  }
}

function targetLink(report: ReportItem): string | null {
  if (report.targetType === "LISTING") return `/listings/${report.targetId}`
  if (report.targetType === "USER") return `/users/${report.targetId}`
  return null
}

export function ReportDetail({ reportId }: { reportId: string }) {
  const report = useResource<ReportItem>(`/admin/trust/reports/${reportId}`)
  if (report.status === "loading") return <Loading />
  if (report.status === "error") {
    return <ErrorState error={report.error} onRetry={report.reload} />
  }
  return <ReportView report={report.data} reload={report.reload} />
}

function ReportView({
  report,
  reload,
}: {
  report: ReportItem
  reload: () => void
}) {
  const link = targetLink(report)
  const isOpen = OPEN.has(report.status)

  return (
    <>
      <PageHeader title={`Signalement : ${report.reason}`}>
        <Link href="/reports" className="text-sm underline underline-offset-2">
          Retour aux signalements
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Signalement">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-stone-500">Statut</dt>
            <dd>
              <Badge value={report.status} />
            </dd>
            <dt className="text-stone-500">Priorité</dt>
            <dd>{report.priority}</dd>
            <dt className="text-stone-500">Cible</dt>
            <dd>
              {report.targetType}{" "}
              {link ? (
                <Link href={link} className="underline underline-offset-2">
                  ouvrir
                </Link>
              ) : null}
            </dd>
            <dt className="text-stone-500">Déclarants distincts</dt>
            <dd>{report.openReportsOnTarget}</dd>
            <dt className="text-stone-500">Déposé le</dt>
            <dd>{formatDateTime(report.createdAt)}</dd>
            <dt className="text-stone-500">Mesure</dt>
            <dd>{report.action ? ACTION_LABELS[report.action] : "—"}</dd>
          </dl>
          <h3 className="mt-4 text-sm font-medium">Description du déclarant</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
            {report.description?.trim() || "Aucune description."}
          </p>
          <p className="mt-3 text-xs text-stone-500">
            Allégation à instruire : elle ne prouve pas une fraude.
          </p>
        </Section>

        <Section title="Traitement">
          {isOpen ? (
            <ReportActions report={report} reload={reload} />
          ) : (
            <p className="text-sm text-stone-600">
              Signalement clos le {formatDateTime(report.resolvedAt)}.
            </p>
          )}
        </Section>

        {report.conversationExcerpt ? (
          <Section title="Extrait de conversation (borné)">
            <ol className="flex flex-col gap-2 text-sm">
              {report.conversationExcerpt.map((message) => (
                <li
                  key={message.id}
                  className={`rounded p-2 ${message.reported ? "bg-amber-50 ring-1 ring-amber-300" : "bg-stone-50"}`}
                >
                  <p className="text-xs text-stone-500">
                    #{message.seq} · {message.authorRole} ·{" "}
                    {formatDateTime(message.createdAt)}
                    {message.reported ? " · message signalé" : ""}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {message.body ?? `(${message.type})`}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        <Section title="Historique">
          <ol className="flex flex-col gap-2 text-sm">
            {report.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="font-medium">{entry.action}</span> →{" "}
                {statusLabel(entry.status)}{" "}
                <span className="text-xs text-stone-500">
                  {formatDateTime(entry.at)}
                </span>
                {entry.internalNote ? (
                  <p className="text-xs text-stone-600">
                    Note interne : {entry.internalNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  )
}

function ReportActions({
  report,
  reload,
}: {
  report: ReportItem
  reload: () => void
}) {
  const id = useId()
  const {
    state: { me },
  } = useSession()
  const assign = useMutation()
  const resolve = useMutation()
  const [outcome, setOutcome] = useState<"CONFIRMED" | "DISMISSED">("DISMISSED")
  const [action, setAction] = useState("NONE")
  const [note, setNote] = useState("")
  const options = actionsFor(report.targetType, can(me, "listing:suspend"))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await resolve.run(
      `/admin/trust/reports/${report.id}/resolve`,
      {
        outcome,
        ...(outcome === "CONFIRMED" ? { action } : {}),
        ...(note.trim() ? { internalNote: note.trim() } : {}),
      },
    )
    if (result.ok) reload()
  }

  return (
    <div className="flex flex-col gap-4">
      {report.status === "OPEN" ? (
        <div>
          <Button
            variant="secondary"
            disabled={assign.pending}
            onClick={async () => {
              const result = await assign.run(
                `/admin/trust/reports/${report.id}/assign`,
                {},
              )
              if (result.ok) reload()
            }}
          >
            {assign.pending ? "Envoi…" : "Prendre en charge"}
          </Button>
          <ActionError error={assign.error} />
        </div>
      ) : null}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="font-medium">Conclusion</legend>
          {(["DISMISSED", "CONFIRMED"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-outcome`}
                value={value}
                checked={outcome === value}
                onChange={() => {
                  setOutcome(value)
                  if (value === "DISMISSED") setAction("NONE")
                }}
              />
              {value === "CONFIRMED"
                ? "Signalement fondé"
                : "Signalement écarté"}
            </label>
          ))}
        </fieldset>
        {outcome === "CONFIRMED" ? (
          <Field label="Mesure" htmlFor={`${id}-action`}>
            <select
              id={`${id}-action`}
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className={inputClass}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {ACTION_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field
          label="Note interne (facultative)"
          htmlFor={`${id}-note`}
          hint="Jamais transmise au déclarant ni à la personne visée."
        >
          <textarea
            id={`${id}-note`}
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </Field>
        <ActionError error={resolve.error} />
        <div>
          <Button type="submit" disabled={resolve.pending}>
            {resolve.pending ? "Envoi…" : "Clore le signalement"}
          </Button>
        </div>
      </form>
    </div>
  )
}
