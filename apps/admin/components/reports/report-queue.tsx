"use client"

import { Filter } from "lucide-react"
import Link from "next/link"
import { useState, type FormEvent } from "react"

import { formatAge, formatDateTime, statusLabel } from "@/lib/format"
import { canAny } from "@/lib/permissions"
import type { ReportItem, SignalItem } from "@/lib/types"
import { usePagedList } from "@/lib/use-api"

import { useSession } from "../session-provider"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  PageHeader,
  Table,
  inputClass,
} from "../ui"
import { SignalReview } from "./signal-review"

type Tab = "reports" | "signals"

export function ReportsView({
  initialTab,
  initialStatus,
}: {
  initialTab: Tab
  initialStatus?: string
}) {
  const {
    state: { me },
  } = useSession()
  const [tab, setTab] = useState<Tab>(initialTab)
  const canSignals = canAny(me, ["verification:review", "report:review"])

  return (
    <>
      <PageHeader
        title="Signalements et alertes"
        description="Un signalement est une allégation, pas une preuve. Les alertes de risque sont des aides à la décision sans effet automatique."
      />
      <div role="tablist" className="mb-4 flex gap-2">
        <Button
          role="tab"
          aria-selected={tab === "reports"}
          variant={tab === "reports" ? "primary" : "secondary"}
          onClick={() => setTab("reports")}
        >
          Signalements
        </Button>
        {canSignals ? (
          <Button
            role="tab"
            aria-selected={tab === "signals"}
            variant={tab === "signals" ? "primary" : "secondary"}
            onClick={() => setTab("signals")}
          >
            Alertes de risque
          </Button>
        ) : null}
      </div>
      {tab === "reports" ? (
        <ReportList initialStatus={initialStatus} />
      ) : (
        <SignalList />
      )}
    </>
  )
}

const REPORT_STATUSES = ["OPEN", "IN_REVIEW", "CONFIRMED", "DISMISSED"]
const TARGETS = ["LISTING", "USER", "MESSAGE", "CONVERSATION"]
const PRIORITIES = ["HIGH", "NORMAL", "LOW"]

function ReportList({ initialStatus }: { initialStatus?: string }) {
  const [filters, setFilters] = useState({
    status: initialStatus ?? "",
    targetType: "",
    priority: "",
  })
  const list = usePagedList<ReportItem>("/admin/trust/reports", {
    ...filters,
    limit: 25,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      status: String(form.get("status") ?? ""),
      targetType: String(form.get("targetType") ?? ""),
      priority: String(form.get("priority") ?? ""),
    })
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          name="status"
          label="Statut"
          value={filters.status}
          options={REPORT_STATUSES}
          allLabel="Ouverts et en examen"
        />
        <Select
          name="targetType"
          label="Cible"
          value={filters.targetType}
          options={TARGETS}
        />
        <Select
          name="priority"
          label="Priorité"
          value={filters.priority}
          options={PRIORITIES}
        />
        <Button type="submit" className="gap-2">
          <Filter aria-hidden className="size-3.5" />
          Filtrer
        </Button>
      </form>
      {list.status === "loading" ? <Loading /> : null}
      {list.status === "error" && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : null}
      {list.status === "ready" ? (
        list.items.length === 0 ? (
          <EmptyState>Aucun signalement pour ces critères.</EmptyState>
        ) : (
          <>
            <Table
              headers={[
                "Motif",
                "Cible",
                "Statut",
                "Priorité",
                "Déclarants distincts",
                "Âge",
              ]}
            >
              {list.items.map((report) => (
                <tr key={report.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/reports/${report.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {report.reason}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{report.targetType}</td>
                  <td className="px-3 py-2">
                    <Badge value={report.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge value={report.priority} label={report.priority} />
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {report.openReportsOnTarget}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatAge(report.createdAt)}
                  </td>
                </tr>
              ))}
            </Table>
            <LoadMore
              hasMore={Boolean(list.nextCursor)}
              loading={list.loadingMore}
              error={list.error}
              onClick={() => void list.loadMore()}
            />
          </>
        )
      ) : null}
    </>
  )
}

function SignalList() {
  const [filters, setFilters] = useState({ status: "OPEN", severity: "" })
  const list = usePagedList<SignalItem>("/admin/trust/signals", {
    ...filters,
    limit: 25,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      status: String(form.get("status") ?? ""),
      severity: String(form.get("severity") ?? ""),
    })
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          name="status"
          label="Statut"
          value={filters.status}
          options={["OPEN", "CONFIRMED", "DISMISSED"]}
        />
        <Select
          name="severity"
          label="Sévérité"
          value={filters.severity}
          options={["HIGH", "MEDIUM", "LOW"]}
        />
        <Button type="submit" className="gap-2">
          <Filter aria-hidden className="size-3.5" />
          Filtrer
        </Button>
      </form>
      {list.status === "loading" ? <Loading /> : null}
      {list.status === "error" && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : null}
      {list.status === "ready" ? (
        list.items.length === 0 ? (
          <EmptyState>Aucune alerte pour ces critères.</EmptyState>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {list.items.map((signal) => (
                <li
                  key={signal.id}
                  className="rounded-lg border border-border bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {signal.ruleCode}
                    </span>
                    <Badge value={signal.severity} label={signal.severity} />
                    <Badge value={signal.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(signal.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-3 text-xs">
                    {signal.userId ? (
                      <Link
                        href={`/users/${signal.userId}`}
                        className="underline"
                      >
                        Compte concerné
                      </Link>
                    ) : null}
                    {signal.listingId ? (
                      <Link
                        href={`/listings/${signal.listingId}`}
                        className="underline"
                      >
                        Annonce concernée
                      </Link>
                    ) : null}
                    {signal.verificationId ? (
                      <Link
                        href={`/verifications/${signal.verificationId}`}
                        className="underline"
                      >
                        Dossier concerné
                      </Link>
                    ) : null}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-xs">
                    {JSON.stringify(signal.details, null, 2)}
                  </pre>
                  {signal.status === "OPEN" ? (
                    <SignalReview signalId={signal.id} onDone={list.reload} />
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {statusLabel(signal.status)} le{" "}
                      {formatDateTime(signal.reviewedAt)}
                      {signal.reviewNote ? ` — ${signal.reviewNote}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <LoadMore
              hasMore={Boolean(list.nextCursor)}
              loading={list.loadingMore}
              error={list.error}
              onClick={() => void list.loadMore()}
            />
          </>
        )
      ) : null}
    </>
  )
}

function Select({
  name,
  label,
  value,
  options,
  allLabel = "Tous",
}: {
  name: string
  label: string
  value: string
  options: string[]
  allLabel?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select name={name} defaultValue={value} className={inputClass}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}
