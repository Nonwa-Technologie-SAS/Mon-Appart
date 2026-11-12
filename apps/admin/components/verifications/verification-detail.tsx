"use client"

import Link from "next/link"
import { useId, useState, type FormEvent } from "react"

import { ApiError, api } from "@/lib/api"
import { formatDateTime, formatNumber, statusLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import type { AdminMe, VerificationDetail as Verification } from "@/lib/types"
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

type ActionKey =
  | "assign"
  | "request-information"
  | "escalate"
  | "approve"
  | "reject"
  | "revoke"

interface ActionSpec {
  label: string
  permission: string
  /** Statuts depuis lesquels l'action est proposée ; l'API tranche. */
  from: string[]
  reasons?: Record<string, string>
  /** Message montré au déclarant. */
  userMessage: boolean
  variant: "primary" | "secondary" | "danger"
}

const IN_PROGRESS = ["PENDING", "IN_REVIEW"]

export const VERIFICATION_ACTIONS: Record<ActionKey, ActionSpec> = {
  assign: {
    label: "Prendre en charge",
    permission: "verification:review",
    from: IN_PROGRESS,
    userMessage: false,
    variant: "secondary",
  },
  "request-information": {
    label: "Demander un complément",
    permission: "verification:review",
    from: IN_PROGRESS,
    userMessage: true,
    variant: "secondary",
    reasons: {
      MISSING_DOCUMENT: "Pièce manquante",
      DOCUMENT_ILLEGIBLE: "Pièce illisible",
      DOCUMENT_EXPIRED: "Pièce expirée",
      CLARIFICATION_NEEDED: "Précision nécessaire",
    },
  },
  escalate: {
    label: "Escalader",
    permission: "verification:review",
    from: IN_PROGRESS,
    userMessage: false,
    variant: "secondary",
  },
  approve: {
    label: "Approuver",
    permission: "verification:approve",
    from: IN_PROGRESS,
    userMessage: true,
    variant: "primary",
  },
  reject: {
    label: "Rejeter",
    permission: "verification:reject",
    from: IN_PROGRESS,
    userMessage: true,
    variant: "danger",
    reasons: {
      DOCUMENT_ILLEGIBLE: "Pièce illisible",
      DOCUMENT_EXPIRED: "Pièce expirée",
      DOCUMENT_MISMATCH: "Pièce incohérente",
      INSUFFICIENT_EVIDENCE: "Preuves insuffisantes",
      RELATION_NOT_ESTABLISHED: "Lien avec le bien non établi",
      OTHER: "Autre",
    },
  },
  revoke: {
    label: "Révoquer",
    permission: "verification:revoke",
    from: ["VERIFIED"],
    userMessage: true,
    variant: "danger",
    reasons: {
      NEW_EVIDENCE: "Élément nouveau",
      CONFIRMED_REPORT: "Signalement confirmé",
      RELATION_ENDED: "Lien avec le bien terminé",
      DOCUMENT_INVALIDATED: "Pièce invalidée",
      USER_REQUEST: "Demande du titulaire",
      OTHER: "Autre",
    },
  },
}

export function availableActions(
  me: AdminMe | null,
  status: string,
): ActionKey[] {
  return (Object.keys(VERIFICATION_ACTIONS) as ActionKey[]).filter((key) => {
    const spec = VERIFICATION_ACTIONS[key]
    return spec.from.includes(status) && can(me, spec.permission)
  })
}

export function VerificationDetail({
  verificationId,
}: {
  verificationId: string
}) {
  const verification = useResource<Verification>(
    `/admin/trust/verifications/${verificationId}`,
  )
  if (verification.status === "loading") return <Loading />
  if (verification.status === "error") {
    return (
      <ErrorState error={verification.error} onRetry={verification.reload} />
    )
  }
  return (
    <VerificationView
      verification={verification.data}
      reload={verification.reload}
    />
  )
}

function VerificationView({
  verification,
  reload,
}: {
  verification: Verification
  reload: () => void
}) {
  const {
    state: { me },
  } = useSession()
  const subject = verification.subject
  const subjectName =
    [subject.firstName, subject.lastName].filter(Boolean).join(" ") ||
    "Sans nom"

  return (
    <>
      <PageHeader title={`Dossier ${verification.type}`}>
        <Link
          href="/verifications"
          className="text-sm underline underline-offset-2"
        >
          Retour à la file
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Dossier">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Statut</dt>
            <dd>
              <Badge value={verification.status} />
            </dd>
            <dt className="text-muted-foreground">Priorité</dt>
            <dd>{verification.priority}</dd>
            <dt className="text-muted-foreground">Titulaire</dt>
            <dd>
              <Link
                href={`/users/${subject.userId}`}
                className="underline underline-offset-2"
              >
                {subjectName}
              </Link>{" "}
              <span className="text-xs text-muted-foreground">
                (tél. {subject.phoneVerified ? "vérifié" : "non vérifié"},
                e-mail {subject.emailVerified ? "vérifié" : "non vérifié"})
              </span>
            </dd>
            {verification.property ? (
              <>
                <dt className="text-muted-foreground">Bien</dt>
                <dd>{verification.property.title}</dd>
              </>
            ) : null}
            {verification.listing ? (
              <>
                <dt className="text-muted-foreground">Annonce</dt>
                <dd>
                  <Link
                    href={`/listings/${verification.listing.id}`}
                    className="underline underline-offset-2"
                  >
                    {verification.listing.title}
                  </Link>
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Rattachement déclaré</dt>
            <dd>{verification.claimedRelation ?? "—"}</dd>
            <dt className="text-muted-foreground">Soumis le</dt>
            <dd>{formatDateTime(verification.submittedAt)}</dd>
          </dl>
          {verification.requirements?.missing.length ? (
            <p className="mt-3 text-xs text-amber-900">
              Pièces encore manquantes :{" "}
              {verification.requirements.missing
                .map((group) => group.join(" ou "))
                .join(" ; ")}
            </p>
          ) : null}
        </Section>

        <Section title="Décision">
          <VerificationActions
            verification={verification}
            me={me}
            reload={reload}
          />
        </Section>

        <Section title="Précontrôles automatiques">
          <p className="mb-2 text-xs text-muted-foreground">
            Aide à l&apos;instruction, jamais une preuve.
          </p>
          <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-xs">
            {JSON.stringify(verification.prechecks, null, 2)}
          </pre>
          {verification.signals.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-xs">
              {verification.signals.map((signal) => (
                <li key={signal.id} className="flex gap-2">
                  <span className="font-mono">{signal.ruleCode}</span>
                  <Badge value={signal.severity} label={signal.severity} />
                  <Badge value={signal.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Pièces">
          <DocumentList verification={verification} me={me} />
        </Section>

        <Section title="Historique">
          <ol className="flex flex-col gap-2 text-sm">
            {verification.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="font-medium">{entry.action}</span> →{" "}
                {statusLabel(entry.status)}{" "}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.at)} · {entry.actorKind}
                </span>
                {entry.reason ? (
                  <p className="text-xs">Motif : {entry.reason.code}</p>
                ) : null}
                {entry.message ? (
                  <p className="text-xs">
                    Message au titulaire : {entry.message}
                  </p>
                ) : null}
                {entry.internalNote ? (
                  <p className="text-xs text-muted-foreground">
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

function DocumentList({
  verification,
  me,
}: {
  verification: Verification
  me: AdminMe | null
}) {
  const [error, setError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const canOpen = can(me, "verification:documents")

  if (verification.documents.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune pièce.</p>
  }

  async function open(documentId: string) {
    setPending(documentId)
    setError(null)
    try {
      const link = await api<{ url: string; expiresAt: string }>(
        `/admin/trust/verifications/${verification.id}/documents/${documentId}/download`,
      )
      // Lien présigné court : ouvert immédiatement, jamais conservé.
      window.open(link.url, "_blank", "noopener,noreferrer")
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "NETWORK_ERROR", "Le service est injoignable."),
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <ul className="flex flex-col gap-2 text-sm">
        {verification.documents.map((document) => (
          <li key={document.id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{document.documentType}</span>
            <Badge value={document.status} />
            <span className="text-xs text-muted-foreground">
              {document.mimeType} ·{" "}
              {formatNumber(Math.round(document.fileSize / 1024))} Ko · analyse
              : {document.scan ?? "—"}
            </span>
            {canOpen ? (
              <Button
                variant="secondary"
                disabled={pending === document.id}
                onClick={() => void open(document.id)}
              >
                {pending === document.id ? "Ouverture…" : "Consulter"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {!canOpen ? (
        <p className="mt-2 text-xs text-muted-foreground">
          La consultation des pièces exige une habilitation dédiée.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Chaque consultation est journalisée ; le lien expire rapidement.
        </p>
      )}
      {error ? <ErrorState error={error} /> : null}
    </>
  )
}

function VerificationActions({
  verification,
  me,
  reload,
}: {
  verification: Verification
  me: AdminMe | null
  reload: () => void
}) {
  const [selected, setSelected] = useState<ActionKey | null>(null)
  const actions = availableActions(me, verification.status)

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {`Aucune action possible depuis le statut « ${statusLabel(verification.status)} » avec vos droits.`}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((key) => (
          <Button
            key={key}
            aria-pressed={selected === key}
            variant={selected === key ? "primary" : "secondary"}
            onClick={() => setSelected(key)}
          >
            {VERIFICATION_ACTIONS[key].label}
          </Button>
        ))}
      </div>
      {selected ? (
        <VerificationActionForm
          key={selected}
          action={selected}
          verificationId={verification.id}
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

function VerificationActionForm({
  action,
  verificationId,
  onDone,
  onCancel,
}: {
  action: ActionKey
  verificationId: string
  onDone: () => void
  onCancel: () => void
}) {
  const id = useId()
  const spec = VERIFICATION_ACTIONS[action]
  const mutation = useMutation()
  const [reasonCode, setReasonCode] = useState("")
  const [message, setMessage] = useState("")
  const [internalNote, setInternalNote] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await mutation.run(
      `/admin/trust/verifications/${verificationId}/${action}`,
      {
        ...(spec.reasons ? { reasonCode } : {}),
        ...(spec.userMessage && message.trim()
          ? { message: message.trim() }
          : {}),
        ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
      },
    )
    if (result.ok) onDone()
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/60 p-3"
    >
      <p className="text-sm font-medium">{spec.label}</p>
      {spec.reasons ? (
        <Field label="Motif (obligatoire)" htmlFor={`${id}-reason`}>
          <select
            id={`${id}-reason`}
            required
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
            className={inputClass}
          >
            <option value="">Choisir un motif</option>
            {Object.entries(spec.reasons).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {spec.userMessage ? (
        <Field
          label="Message au titulaire (facultatif)"
          htmlFor={`${id}-message`}
          hint="Visible du titulaire : aucun détail antifraude."
        >
          <textarea
            id={`${id}-message`}
            rows={2}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={inputClass}
          />
        </Field>
      ) : null}
      <Field
        label="Note interne (facultative)"
        htmlFor={`${id}-note`}
        hint="Réservée aux relecteurs."
      >
        <textarea
          id={`${id}-note`}
          rows={2}
          maxLength={2000}
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          className={inputClass}
        />
      </Field>
      <ActionError error={mutation.error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={spec.variant === "secondary" ? "primary" : spec.variant}
          disabled={mutation.pending || (Boolean(spec.reasons) && !reasonCode)}
        >
          {mutation.pending ? "Envoi…" : "Confirmer"}
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
