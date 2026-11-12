"use client"

import { Filter } from "lucide-react"
import Link from "next/link"
import { useState, type FormEvent, type ReactNode } from "react"

import { formatDateTime, formatMoney, statusLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import type {
  BillingIncident,
  BillingOrder,
  BillingPayment,
  BillingRefund,
  BillingSubscription,
} from "@/lib/types"
import { useMutation, usePagedList } from "@/lib/use-api"

import { ReasonedAction } from "../reasoned-action"
import { useSession } from "../session-provider"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  Table,
  inputClass,
} from "../ui"

type List<T> = ReturnType<typeof usePagedList<T>>

function StatusFilter({
  statuses,
  value,
  onChange,
}: {
  statuses: string[]
  value: string
  onChange: (value: string) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onChange(String(new FormData(event.currentTarget).get("status") ?? ""))
  }
  return (
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Statut
        <select name="status" defaultValue={value} className={inputClass}>
          <option value="">Tous</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" className="gap-2">
        <Filter aria-hidden className="size-3.5" />
        Filtrer
      </Button>
    </form>
  )
}

function ListFrame<T>({
  list,
  empty,
  children,
}: {
  list: List<T>
  empty: string
  children: ReactNode
}) {
  if (list.status === "loading") return <Loading />
  if (list.status === "error" && list.error) {
    return <ErrorState error={list.error} onRetry={list.reload} />
  }
  if (list.items.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <>
      {children}
      <LoadMore
        hasMore={Boolean(list.nextCursor)}
        loading={list.loadingMore}
        error={list.error}
        onClick={() => void list.loadMore()}
      />
    </>
  )
}

const cell = "px-3 py-2"

export function OrderList() {
  const [status, setStatus] = useState("")
  const list = usePagedList<BillingOrder>("/admin/billing/orders", {
    status,
    limit: 25,
  })
  return (
    <>
      <StatusFilter
        statuses={["PENDING", "PAID", "CANCELLED", "EXPIRED", "REFUNDED"]}
        value={status}
        onChange={setStatus}
      />
      <ListFrame list={list} empty="Aucune commande pour ce filtre.">
        <Table
          headers={[
            "Commande",
            "Client",
            "Type",
            "Statut",
            "Montant",
            "Droit accordé",
            "Créée",
          ]}
        >
          {list.items.map((order) => (
            <tr key={order.id}>
              <td className={cell}>
                <Link
                  href={`/billing/orders/${order.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {order.product.name}
                </Link>
              </td>
              <td className={cell}>
                <Link href={`/users/${order.buyer.id}`} className="underline">
                  {order.buyer.name ?? "Compte"}
                </Link>
              </td>
              <td className={`${cell} text-xs`}>{statusLabel(order.kind)}</td>
              <td className={cell}>
                <Badge value={order.status} />
              </td>
              <td className={`${cell} tabular-nums`}>
                {formatMoney(order.amount, order.currency)}
              </td>
              <td className={`${cell} text-xs`}>
                {order.status === "PAID" && !order.fulfilled ? (
                  <span className="font-medium text-red-700">Non accordé</span>
                ) : order.fulfilled ? (
                  "Oui"
                ) : (
                  "—"
                )}
              </td>
              <td className={`${cell} text-xs`}>
                {formatDateTime(order.createdAt)}
              </td>
            </tr>
          ))}
        </Table>
      </ListFrame>
    </>
  )
}

export function PaymentList() {
  const [status, setStatus] = useState("")
  const list = usePagedList<BillingPayment>("/admin/billing/payments", {
    status,
    limit: 25,
  })
  return (
    <>
      <StatusFilter
        statuses={[
          "CREATED",
          "PENDING",
          "SUCCEEDED",
          "FAILED",
          "CANCELLED",
          "EXPIRED",
        ]}
        value={status}
        onChange={setStatus}
      />
      <ListFrame
        list={list}
        empty="Aucune tentative de paiement pour ce filtre."
      >
        <Table
          headers={[
            "Commande",
            "Client",
            "Prestataire",
            "Statut",
            "Montant",
            "Remboursé",
            "Vérifications",
            "Créée",
          ]}
        >
          {list.items.map((payment) => (
            <tr key={payment.id}>
              <td className={cell}>
                <Link
                  href={`/billing/orders/${payment.orderId}`}
                  className="underline underline-offset-2"
                >
                  Diagnostic
                </Link>
              </td>
              <td className={`${cell} text-xs`}>
                {payment.buyer?.name ?? "Compte"}
              </td>
              <td className={`${cell} text-xs`}>
                {payment.provider} · {payment.environment}
              </td>
              <td className={cell}>
                <Badge value={payment.status} />
                {payment.failureCode ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {payment.failureCode}
                  </span>
                ) : null}
              </td>
              <td className={`${cell} tabular-nums`}>
                {formatMoney(payment.amount, payment.currency)}
              </td>
              <td className={`${cell} tabular-nums`}>
                {formatMoney(payment.refundedAmount, payment.currency)}
              </td>
              <td className={`${cell} text-xs`}>
                {payment.checkAttempts} ·{" "}
                {formatDateTime(payment.lastCheckedAt)}
              </td>
              <td className={`${cell} text-xs`}>
                {formatDateTime(payment.createdAt)}
              </td>
            </tr>
          ))}
        </Table>
      </ListFrame>
    </>
  )
}

export function SubscriptionList() {
  const [status, setStatus] = useState("")
  const list = usePagedList<BillingSubscription>(
    "/admin/billing/subscriptions",
    { status, limit: 25 },
  )
  return (
    <>
      <StatusFilter
        statuses={["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]}
        value={status}
        onChange={setStatus}
      />
      <ListFrame list={list} empty="Aucun abonnement pour ce filtre.">
        <Table
          headers={[
            "Client",
            "Plan",
            "Statut",
            "Échéance",
            "Fin de grâce",
            "Annonces actives max.",
          ]}
        >
          {list.items.map((subscription) => (
            <tr key={subscription.id}>
              <td className={cell}>
                <Link
                  href={`/users/${subscription.user.id}`}
                  className="underline"
                >
                  {subscription.user.name ?? "Compte"}
                </Link>
              </td>
              <td className={cell}>{subscription.product.name}</td>
              <td className={cell}>
                <Badge value={subscription.status} />
                {subscription.cancelAtPeriodEnd ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    résiliation à l’échéance
                  </span>
                ) : null}
              </td>
              <td className={`${cell} text-xs`}>
                {formatDateTime(subscription.currentPeriodEnd)}
              </td>
              <td className={`${cell} text-xs`}>
                {formatDateTime(subscription.graceEndsAt)}
              </td>
              <td className={`${cell} tabular-nums`}>
                {subscription.maxActiveListings ?? "Illimité"}
              </td>
            </tr>
          ))}
        </Table>
      </ListFrame>
    </>
  )
}

export function RefundList() {
  const [status, setStatus] = useState("REQUESTED")
  const list = usePagedList<BillingRefund>("/admin/billing/refunds", {
    status,
    limit: 25,
  })
  return (
    <>
      <StatusFilter
        statuses={[
          "REQUESTED",
          "PROCESSING",
          "SUCCEEDED",
          "FAILED",
          "REJECTED",
        ]}
        value={status}
        onChange={setStatus}
      />
      <ListFrame list={list} empty="Aucun remboursement pour ce filtre.">
        <ul className="flex flex-col gap-3">
          {list.items.map((refund) => (
            <li
              key={refund.id}
              className="rounded-lg border border-border bg-white p-4"
            >
              <RefundCard refund={refund} onDone={list.reload} />
            </li>
          ))}
        </ul>
      </ListFrame>
    </>
  )
}

export function RefundCard({
  refund,
  onDone,
}: {
  refund: BillingRefund
  onDone: () => void
}) {
  const {
    state: { me },
  } = useSession()
  const approve = useMutation()
  const reject = useMutation()
  const base = `/admin/billing/refunds/${refund.id}`
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium tabular-nums">
          {formatMoney(refund.amount, refund.currency)}
        </span>
        <Badge value={refund.status} />
        <span className="text-xs text-muted-foreground">
          {refund.requestedByCustomer
            ? "Demande du client"
            : "Demande de l'équipe"}{" "}
          · {formatDateTime(refund.createdAt)}
        </span>
        <Link
          href={`/billing/orders/${refund.orderId}`}
          className="text-xs underline"
        >
          Commande
        </Link>
      </div>
      <p className="mt-2 text-sm">{refund.reason}</p>
      {refund.decisionNote ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Décision : {refund.decisionNote}
        </p>
      ) : null}
      {refund.failureCode ? (
        <p className="mt-1 font-mono text-xs text-red-700">
          {refund.failureCode}
        </p>
      ) : null}
      {refund.status === "PROCESSING" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          En attente de confirmation du prestataire : rien n’est considéré comme
          remboursé avant.
        </p>
      ) : null}
      {refund.status === "REQUESTED" && can(me, "billing:refund") ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <ReasonedAction
            label="Valider et exécuter"
            description="Validation impossible par l'auteur de la demande. Le prestataire doit confirmer le remboursement."
            variant="primary"
            minLength={10}
            pending={approve.pending}
            error={approve.error}
            onSubmit={async (note) => {
              const result = await approve.run(`${base}/approve`, { note })
              if (result.ok) onDone()
              return result.ok
            }}
          />
          <ReasonedAction
            label="Refuser"
            variant="danger"
            minLength={10}
            pending={reject.pending}
            error={reject.error}
            onSubmit={async (note) => {
              const result = await reject.run(`${base}/reject`, { note })
              if (result.ok) onDone()
              return result.ok
            }}
          />
        </div>
      ) : null}
    </>
  )
}

export function IncidentList() {
  const [status, setStatus] = useState("OPEN")
  const list = usePagedList<BillingIncident>("/admin/billing/incidents", {
    status,
    limit: 25,
  })
  return (
    <>
      <StatusFilter
        statuses={["OPEN", "RESOLVED"]}
        value={status}
        onChange={setStatus}
      />
      <ListFrame list={list} empty="Aucun incident pour ce filtre.">
        <ul className="flex flex-col gap-3">
          {list.items.map((incident) => (
            <li
              key={incident.id}
              className="rounded-lg border border-border bg-white p-4"
            >
              <IncidentCard incident={incident} onDone={list.reload} />
            </li>
          ))}
        </ul>
      </ListFrame>
    </>
  )
}

export function IncidentCard({
  incident,
  onDone,
}: {
  incident: BillingIncident
  onDone: () => void
}) {
  const {
    state: { me },
  } = useSession()
  const resolve = useMutation()
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{statusLabel(incident.kind)}</span>
        <Badge value={incident.status} />
        <span className="text-xs text-muted-foreground">
          {formatDateTime(incident.createdAt)}
        </span>
        {incident.orderId ? (
          <Link
            href={`/billing/orders/${incident.orderId}`}
            className="text-xs underline"
          >
            Commande
          </Link>
        ) : null}
      </div>
      <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-xs">
        {JSON.stringify(incident.detail, null, 2)}
      </pre>
      {incident.status === "OPEN" && can(me, "billing:reconcile") ? (
        <div className="mt-3">
          <ReasonedAction
            label="Clore l'incident"
            description="Trace la résolution. Ne modifie ni le paiement ni la commande : un remboursement se demande à part."
            reasonLabel="Résolution (obligatoire)"
            minLength={10}
            maxLength={1000}
            pending={resolve.pending}
            error={resolve.error}
            onSubmit={async (resolution) => {
              const result = await resolve.run(
                `/admin/billing/incidents/${incident.id}/resolve`,
                { resolution },
              )
              if (result.ok) onDone()
              return result.ok
            }}
          />
        </div>
      ) : incident.resolution ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Clos le {formatDateTime(incident.resolvedAt)}
          {incident.resolvedBy?.name
            ? ` par ${incident.resolvedBy.name}`
            : ""}{" "}
          — {incident.resolution}
        </p>
      ) : null}
    </>
  )
}
