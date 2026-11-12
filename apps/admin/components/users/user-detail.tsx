"use client"

import Link from "next/link"
import { useState } from "react"

import { ApiError, api } from "@/lib/api"
import {
  ACCOUNT_DECISION_LABELS,
  formatDateTime,
  formatRoles,
  statusLabel,
} from "@/lib/format"
import { can } from "@/lib/permissions"
import type { AccountDecision, AdminUserDetail } from "@/lib/types"
import { useMutation, useResource } from "@/lib/use-api"

import { AuditTable } from "../audit-table"
import { NotesPanel } from "../notes-panel"
import { ReasonedAction } from "../reasoned-action"
import { useSession } from "../session-provider"
import {
  Badge,
  Button,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Section,
  inputClass,
} from "../ui"

const DECISION_PATH: Record<AccountDecision, string> = {
  SUSPEND: "suspend",
  BAN: "ban",
  REACTIVATE: "reactivate",
}

export function UserDetail({ userId }: { userId: string }) {
  const user = useResource<AdminUserDetail>(`/admin/users/${userId}`)

  if (user.status === "loading") return <Loading />
  if (user.status === "error") {
    return <ErrorState error={user.error} onRetry={user.reload} />
  }
  return <UserDetailView user={user.data} reload={user.reload} />
}

function UserDetailView({
  user,
  reload,
}: {
  user: AdminUserDetail
  reload: () => void
}) {
  const base = `/admin/users/${user.id}`

  return (
    <>
      <PageHeader title={user.name ?? "Compte sans nom"}>
        <Link href="/users" className="text-sm underline underline-offset-2">
          Retour à la liste
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Compte">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Statut</dt>
            <dd>
              <Badge value={user.status} />
            </dd>
            <dt className="text-muted-foreground">Rôles</dt>
            <dd>{formatRoles(user.roles)}</dd>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-mono text-xs">
              {user.email ?? "—"} {user.emailVerified ? "(vérifié)" : ""}
            </dd>
            <dt className="text-muted-foreground">Téléphone</dt>
            <dd className="font-mono text-xs">
              {user.phone ?? "—"} {user.phoneVerified ? "(vérifié)" : ""}
            </dd>
            <dt className="text-muted-foreground">Inscription</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
            <dt className="text-muted-foreground">Dernière connexion</dt>
            <dd>{formatDateTime(user.lastLoginAt)}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {user.contactRevealed
              ? "Coordonnées complètes : cette consultation est enregistrée dans le journal d'audit."
              : "Coordonnées masquées : l'habilitation aux données personnelles est nécessaire pour les voir."}
          </p>
        </Section>

        <Section title="Activité">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Sessions actives</dt>
            <dd>{user.activity.activeSessions}</dd>
            <dt className="text-muted-foreground">Biens gérés</dt>
            <dd>{user.activity.managedProperties}</dd>
            <dt className="text-muted-foreground">Annonces</dt>
            <dd>
              {Object.keys(user.activity.listingsByStatus).length === 0
                ? "Aucune"
                : Object.entries(user.activity.listingsByStatus)
                    .map(
                      ([status, count]) => `${statusLabel(status)} : ${count}`,
                    )
                    .join(" · ")}
            </dd>
            <dt className="text-muted-foreground">Signalements déposés</dt>
            <dd>{user.activity.reportsFiled}</dd>
            <dt className="text-muted-foreground">
              Signalements ouverts le visant
            </dt>
            <dd>{user.activity.openReportsAgainst}</dd>
            <dt className="text-muted-foreground">
              Alertes de risque ouvertes
            </dt>
            <dd>{user.activity.openSignals}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Un signalement est une allégation, pas une preuve.
          </p>
        </Section>

        <Section title="Actions sur le compte">
          <AccountActions user={user} base={base} reload={reload} />
        </Section>

        <TrustScorePanel userId={user.id} />

        <Section title="Vérifications">
          {user.verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun dossier.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {user.verifications.map((verification) => (
                <li
                  key={verification.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Link
                    href={`/verifications/${verification.id}`}
                    className="underline underline-offset-2"
                  >
                    {verification.type}
                  </Link>
                  <Badge value={verification.status} />
                  <span className="text-xs text-muted-foreground">
                    soumis {formatDateTime(verification.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <NotesPanel
          notes={user.notes}
          postPath={`${base}/notes`}
          canAdd={user.actions.addNote}
          onAdded={reload}
        />
      </div>
      {user.audit ? (
        <div className="mt-6">
          <Section title="Journal d'audit du compte">
            <AuditTable entries={user.audit} />
          </Section>
        </div>
      ) : null}
    </>
  )
}

function AccountActions({
  user,
  base,
  reload,
}: {
  user: AdminUserDetail
  base: string
  reload: () => void
}) {
  const decision = useMutation()
  const sessions = useMutation()
  const { decisions, revokeSessions, manageableRoles } = user.actions

  if (
    decisions.length === 0 &&
    !revokeSessions &&
    manageableRoles.length === 0
  ) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune action n&apos;est permise sur ce compte avec vos droits.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {decisions.map((kind) => (
          <ReasonedAction
            key={kind}
            label={ACCOUNT_DECISION_LABELS[kind] ?? kind}
            variant={kind === "REACTIVATE" ? "primary" : "danger"}
            description={
              kind === "REACTIVATE"
                ? "Le titulaire sera notifié. Le statut redevient actif si une coordonnée est vérifiée."
                : "Toutes les sessions du compte seront révoquées. Aucune levée automatique."
            }
            pending={decision.pending}
            error={decision.error}
            onSubmit={async (reason) => {
              const result = await decision.run(
                `${base}/${DECISION_PATH[kind]}`,
                { reason, expectedStatus: user.status },
              )
              if (result.ok) reload()
              return result.ok
            }}
          />
        ))}
        {revokeSessions ? (
          <ReasonedAction
            label="Déconnecter tous les appareils"
            description="Le titulaire devra se reconnecter."
            pending={sessions.pending}
            error={sessions.error}
            onSubmit={async (reason) => {
              const result = await sessions.run(`${base}/revoke-sessions`, {
                reason,
              })
              if (result.ok) reload()
              return result.ok
            }}
          />
        ) : null}
      </div>
      {manageableRoles.length > 0 ? (
        <RoleManager user={user} base={base} reload={reload} />
      ) : null}
    </div>
  )
}

function RoleManager({
  user,
  base,
  reload,
}: {
  user: AdminUserDetail
  base: string
  reload: () => void
}) {
  const mutation = useMutation()
  const [role, setRole] = useState(user.actions.manageableRoles[0] ?? "")
  const holds = user.roles.includes(role)

  return (
    <ReasonedAction
      label="Modifier les rôles"
      description="Opération auditée. Un retrait de rôle révoque les sessions du compte."
      pending={mutation.pending}
      error={mutation.error}
      onSubmit={async (reason) => {
        const result = await mutation.run(`${base}/roles`, {
          role,
          operation: holds ? "revoke" : "grant",
          reason,
        })
        if (result.ok) reload()
        return result.ok
      }}
    >
      <Field
        label="Rôle"
        htmlFor="role-select"
        hint={holds ? "Le rôle sera retiré." : "Le rôle sera attribué."}
      >
        <select
          id="role-select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className={inputClass}
        >
          {user.actions.manageableRoles.map((code) => (
            <option key={code} value={code}>
              {code}
              {user.roles.includes(code) ? " (détenu)" : ""}
            </option>
          ))}
        </select>
      </Field>
    </ReasonedAction>
  )
}

interface TrustScore {
  score: number | null
  isComplete: boolean
  algorithmVersion: string
  factors: Array<{ code: string; observed: boolean | number; points: number }>
  computedAt: string
}

/** Consultation explicite (auditée côté API), jamais automatique. */
function TrustScorePanel({ userId }: { userId: string }) {
  const {
    state: { me },
  } = useSession()
  const [score, setScore] = useState<TrustScore | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  if (!can(me, "trust_score:read")) return null

  async function load() {
    setPending(true)
    setError(null)
    try {
      setScore(await api<TrustScore>(`/admin/trust/users/${userId}/score`))
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "NETWORK_ERROR", "Le service est injoignable."),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Section title="Score de confiance interne">
      <p className="mb-3 text-xs text-muted-foreground">
        Aide à la décision, jamais une preuve ni un motif de sanction à lui
        seul. Chaque consultation est journalisée.
      </p>
      {score ? (
        <div className="text-sm">
          <p className="text-2xl font-semibold tabular-nums">
            {score.score ?? "Données insuffisantes"}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {score.factors.map((factor) => (
              <li key={factor.code}>
                {factor.code} : {String(factor.observed)} ({factor.points} pts)
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Version {score.algorithmVersion} · calculé{" "}
            {formatDateTime(score.computedAt)}
          </p>
        </div>
      ) : (
        <Button variant="secondary" onClick={load} disabled={pending}>
          {pending ? "Chargement…" : "Consulter le score"}
        </Button>
      )}
      {error ? <ErrorState error={error} /> : null}
    </Section>
  )
}
