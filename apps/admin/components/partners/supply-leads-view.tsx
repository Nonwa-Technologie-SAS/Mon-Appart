"use client"

import { useState, type FormEvent } from "react"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useResource } from "@/lib/use-api"

import { useSession } from "../session-provider"
import { EmptyState, ErrorState, Loading, PageHeader, Table } from "../ui"

type LeadRow = {
  id: string
  segment: string
  stage: string
  displayName: string
  organizationName: string | null
  phone: string | null
  zoneCodes: string[]
  activeListings: number
  nextAction: string | null
  nextActionAt: string | null
  createdAt: string
}

const cell = "px-3 py-2 align-top"

const SEGMENTS = [
  "OWNER",
  "SMALL_AGENCY",
  "ESTABLISHED_AGENCY",
  "DEVELOPER",
  "PROPERTY_MANAGER",
  "LAND_SPECIALIST",
  "OTHER",
] as const

/**
 * Pipeline commercial acquisition d’offre — V1 création + liste.
 * Pas de leads fictifs ; données saisies après autorisation terrain.
 */
export function SupplyLeadsView() {
  const {
    state: { me },
  } = useSession()
  const [cursor, setCursor] = useState<string | undefined>()
  const [stageFilter, setStageFilter] = useState("")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  if (stageFilter) params.set("stage", stageFilter)
  const query = params.toString() ? `?${params}` : ""

  const resource = useResource<{
    items: LeadRow[]
    nextCursor: string | null
  }>(`/admin/supply-leads${query}`)

  if (!can(me, "partner:read") && !can(me, "partner:manage")) {
    return (
      <EmptyState>
        Accès réservé aux comptes habilités aux partenariats / acquisition
        d’offre.
      </EmptyState>
    )
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!can(me, "partner:manage")) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setFormError(null)
    try {
      await api("/admin/supply-leads", {
        method: "POST",
        body: {
          segment: String(form.get("segment") || "OWNER"),
          displayName: String(form.get("displayName") || "").trim(),
          organizationName:
            String(form.get("organizationName") || "").trim() || undefined,
          phone: String(form.get("phone") || "").trim() || undefined,
          zoneCodes: String(form.get("zones") || "")
            .split(",")
            .map((z) => z.trim())
            .filter(Boolean),
          nextAction: String(form.get("nextAction") || "").trim() || undefined,
          notes: String(form.get("notes") || "").trim() || undefined,
        },
      })
      event.currentTarget.reset()
      setCursor(undefined)
      resource.reload()
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Création impossible",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Acquisition offre"
        description="Pipeline terrain des propriétaires et agences. Une inscription n’est pas une activation. Aucun prospect inventé."
      />

      {can(me, "partner:manage") ? (
        <form
          onSubmit={onCreate}
          className="mb-6 grid gap-3 rounded border border-zinc-200 p-4 md:grid-cols-2"
        >
          <label className="text-sm">
            Segment
            <select
              name="segment"
              className="mt-1 w-full rounded border px-2 py-1"
              defaultValue="OWNER"
            >
              {SEGMENTS.map((segment) => (
                <option key={segment} value={segment}>
                  {segment}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nom affiché *
            <input
              name="displayName"
              required
              minLength={2}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Organisation
            <input
              name="organizationName"
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Téléphone
            <input
              name="phone"
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Zones (codes séparés par des virgules, ex. ABIDJAN_COCODY)
            <input
              name="zones"
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Prochaine action
            <input
              name="nextAction"
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Notes
            <textarea
              name="notes"
              rows={2}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          {formError ? (
            <p className="md:col-span-2 text-sm text-red-600">{formError}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 md:col-span-2 md:w-fit"
          >
            {busy ? "Enregistrement…" : "Ajouter un prospect"}
          </button>
        </form>
      ) : null}

      <div className="mb-3 flex items-center gap-2 text-sm">
        <label>
          Filtrer stage
          <select
            className="ml-2 rounded border px-2 py-1"
            value={stageFilter}
            onChange={(event) => {
              setStageFilter(event.target.value)
              setCursor(undefined)
            }}
          >
            <option value="">Tous</option>
            {[
              "IDENTIFIED",
              "TO_CONTACT",
              "CONTACTED",
              "QUALIFIED",
              "DEMO",
              "REGISTERED",
              "LISTINGS_SUBMITTED",
              "VERIFICATION",
              "FIRST_PUBLISHED",
              "ACTIVATED",
              "NURTURE",
              "REFUSED",
              "CHURN_RISK",
            ].map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
      </div>

      {resource.status === "loading" ? <Loading /> : null}
      {resource.status === "error" ? (
        <ErrorState error={resource.error} onRetry={resource.reload} />
      ) : null}
      {resource.status === "ready" && resource.data.items.length === 0 ? (
        <EmptyState>
          Aucun prospect. Saisissez uniquement des contacts obtenus légitimement
          après autorisation de prospection.
        </EmptyState>
      ) : null}
      {resource.status === "ready" && resource.data.items.length > 0 ? (
        <Table
          headers={[
            "Nom",
            "Segment",
            "Stage",
            "Zones",
            "Actives",
            "Prochaine action",
            "Créé",
          ]}
        >
          {resource.data.items.map((lead) => (
            <tr key={lead.id}>
              <td className={cell}>
                <div className="font-medium">{lead.displayName}</div>
                {lead.organizationName ? (
                  <div className="text-xs text-zinc-500">
                    {lead.organizationName}
                  </div>
                ) : null}
                {lead.phone ? (
                  <div className="text-xs text-zinc-500">{lead.phone}</div>
                ) : null}
              </td>
              <td className={cell}>{lead.segment}</td>
              <td className={cell}>{lead.stage}</td>
              <td className={`${cell} text-xs`}>
                {lead.zoneCodes.length ? lead.zoneCodes.join(", ") : "—"}
              </td>
              <td className={cell}>{lead.activeListings}</td>
              <td className={`${cell} text-xs`}>
                {lead.nextAction || "—"}
                {lead.nextActionAt ? (
                  <div>{formatDateTime(lead.nextActionAt)}</div>
                ) : null}
              </td>
              <td className={`${cell} text-xs`}>
                {formatDateTime(lead.createdAt)}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}
      {resource.status === "ready" && resource.data.nextCursor ? (
        <button
          type="button"
          className="mt-3 text-sm underline"
          onClick={() => setCursor(resource.data.nextCursor ?? undefined)}
        >
          Charger plus
        </button>
      ) : null}
    </>
  )
}
