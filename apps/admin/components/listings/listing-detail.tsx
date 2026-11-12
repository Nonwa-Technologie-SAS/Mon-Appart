"use client"

import Link from "next/link"
import { useId, useState, type FormEvent } from "react"

import {
  DECISION_LABELS,
  formatDateTime,
  formatNumber,
  formatPrice,
  statusLabel,
} from "@/lib/format"
import { can } from "@/lib/permissions"
import type { ListingDetail as Listing, ModerationDecision } from "@/lib/types"
import { useMutation, useResource } from "@/lib/use-api"

import { NotesPanel } from "../notes-panel"
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

const DECISION_PATH: Record<ModerationDecision, string> = {
  APPROVE: "approve",
  REJECT: "reject",
  REQUEST_CHANGES: "request-changes",
  SUSPEND: "suspend",
  RESTORE: "restore",
}

const CHECK_LABELS: Record<string, string> = {
  PASS: "Conforme",
  WARN: "À vérifier",
  UNKNOWN: "Indéterminé",
}

export function ListingDetail({ listingId }: { listingId: string }) {
  const listing = useResource<Listing>(`/admin/listings/${listingId}`)

  if (listing.status === "loading") return <Loading />
  if (listing.status === "error") {
    return <ErrorState error={listing.error} onRetry={listing.reload} />
  }
  return <ListingView listing={listing.data} reload={listing.reload} />
}

function ListingView({
  listing,
  reload,
}: {
  listing: Listing
  reload: () => void
}) {
  const {
    state: { me },
  } = useSession()
  const base = `/admin/listings/${listing.id}`

  return (
    <>
      <PageHeader title={listing.title}>
        <Link
          href={`/listings?status=${listing.status}`}
          className="text-sm underline underline-offset-2"
        >
          Retour à la file
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Annonce">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Statut</dt>
            <dd>
              <Badge value={listing.status} />
            </dd>
            <dt className="text-muted-foreground">Offre</dt>
            <dd>{listing.listingType}</dd>
            <dt className="text-muted-foreground">Prix</dt>
            <dd>{formatPrice(listing.price)}</dd>
            <dt className="text-muted-foreground">Annonceur</dt>
            <dd>
              <Link
                href={`/users/${listing.publisher.id}`}
                className="underline underline-offset-2"
              >
                {listing.publisher.name ?? "Sans nom"}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Bien</dt>
            <dd>
              {listing.property.type.name}
              {listing.property.surface
                ? ` · ${formatNumber(listing.property.surface)} m²`
                : ""}
              {listing.property.bedrooms !== null
                ? ` · ${listing.property.bedrooms} ch.`
                : ""}
            </dd>
            <dt className="text-muted-foreground">Localisation</dt>
            <dd>
              {[listing.property.neighborhood, listing.property.commune]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
            <dt className="text-muted-foreground">Photos publiques</dt>
            <dd>{listing.property.publicPhotos}</dd>
            <dt className="text-muted-foreground">Publiée le</dt>
            <dd>{formatDateTime(listing.publishedAt)}</dd>
          </dl>
          <h3 className="mt-4 text-sm font-medium">Description</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {listing.description?.trim() || "Aucune description."}
          </p>
        </Section>

        <Section title="Contrôles de cohérence">
          <p className="mb-3 text-xs text-muted-foreground">
            Aide à la décision calculée automatiquement : ce ne sont ni des
            preuves ni des sanctions.
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {listing.checks.map((check) => (
              <li key={check.code} className="flex items-start gap-2">
                <Badge
                  value={check.outcome}
                  label={CHECK_LABELS[check.outcome] ?? check.outcome}
                />
                <span>{check.detail}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Décision">
          <ModerationPanel listing={listing} base={base} reload={reload} />
        </Section>

        <Section title="Signalements récents">
          {listing.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun signalement.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {listing.reports.map((report) => (
                <li key={report.id} className="flex flex-wrap gap-2">
                  <Link
                    href={`/reports/${report.id}`}
                    className="underline underline-offset-2"
                  >
                    {report.reason}
                  </Link>
                  <Badge value={report.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(report.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Un signalement est une allégation, pas une preuve.
          </p>
        </Section>

        <Section title="Historique des statuts">
          <ol className="flex flex-col gap-2 text-sm">
            {listing.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="font-medium">
                  {entry.from ? statusLabel(entry.from) : "Création"} →{" "}
                  {statusLabel(entry.to)}
                </span>{" "}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.at)}
                </span>
                {entry.reason ? (
                  <p className="text-xs text-muted-foreground">
                    {entry.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        <NotesPanel
          notes={listing.notes}
          postPath={`${base}/notes`}
          canAdd={can(me, "admin_note:create")}
          onAdded={reload}
        />
      </div>
    </>
  )
}

function ModerationPanel({
  listing,
  base,
  reload,
}: {
  listing: Listing
  base: string
  reload: () => void
}) {
  const [selected, setSelected] = useState<ModerationDecision | null>(null)

  if (listing.decisions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {`Aucune décision possible depuis le statut « ${statusLabel(listing.status)} » avec vos droits.`}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {listing.decisions.map((decision) => (
          <Button
            key={decision}
            variant={selected === decision ? "primary" : "secondary"}
            aria-pressed={selected === decision}
            onClick={() => setSelected(decision)}
          >
            {DECISION_LABELS[decision] ?? decision}
          </Button>
        ))}
      </div>
      {selected ? (
        <ModerationForm
          key={selected}
          decision={selected}
          listing={listing}
          base={base}
          onDone={() => {
            setSelected(null)
            reload()
          }}
          onCancel={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}

export function ModerationForm({
  decision,
  listing,
  base,
  onDone,
  onCancel,
}: {
  decision: ModerationDecision
  listing: Pick<Listing, "status" | "reasons">
  base: string
  onDone: () => void
  onCancel: () => void
}) {
  const id = useId()
  const mutation = useMutation()
  const reasons = listing.reasons[decision]
  const needsReason = reasons !== undefined
  const needsJustification = decision === "RESTORE"
  const [reasonCode, setReasonCode] = useState("")
  const [ownerMessage, setOwnerMessage] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const reason = reasons?.find((item) => item.code === reasonCode)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await mutation.run(`${base}/${DECISION_PATH[decision]}`, {
      expectedStatus: listing.status,
      ...(reasonCode ? { reasonCode } : {}),
      ...(ownerMessage.trim() ? { ownerMessage: ownerMessage.trim() } : {}),
      ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
    })
    if (result.ok) onDone()
  }

  if (needsReason && reasons.length === 0) {
    return (
      <p role="alert" className="text-sm text-amber-900">
        Aucun motif actif pour cette décision. Un administrateur doit en activer
        un dans « Motifs de modération ».
      </p>
    )
  }

  const incomplete =
    (needsReason && !reasonCode) ||
    (needsJustification && internalNote.trim().length === 0)

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/60 p-3"
    >
      <p className="text-sm font-medium">{DECISION_LABELS[decision]}</p>
      {needsReason ? (
        <Field label="Motif (obligatoire)" htmlFor={`${id}-reason`}>
          <select
            id={`${id}-reason`}
            required
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
            className={inputClass}
          >
            <option value="">Choisir un motif</option>
            {reasons.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {reason ? (
        <p className="rounded bg-white p-2 text-xs text-foreground">
          Message transmis à l&apos;annonceur : « {reason.ownerMessage} »
        </p>
      ) : null}
      <Field
        label="Précision pour l'annonceur (facultatif)"
        htmlFor={`${id}-owner`}
        hint="Visible par l'annonceur dans sa notification. N'y mettez aucun détail antifraude."
      >
        <textarea
          id={`${id}-owner`}
          rows={2}
          maxLength={500}
          value={ownerMessage}
          onChange={(event) => setOwnerMessage(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field
        label={
          needsJustification
            ? "Justification interne (obligatoire)"
            : "Note interne (facultative)"
        }
        htmlFor={`${id}-note`}
        hint="Jamais visible de l'annonceur."
      >
        <textarea
          id={`${id}-note`}
          rows={2}
          maxLength={2000}
          required={needsJustification}
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          className={inputClass}
        />
      </Field>
      <ActionError error={mutation.error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={
            decision === "APPROVE" || decision === "RESTORE"
              ? "primary"
              : "danger"
          }
          disabled={mutation.pending || incomplete}
        >
          {mutation.pending ? "Envoi…" : "Confirmer la décision"}
        </Button>
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={mutation.pending}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
