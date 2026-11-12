"use client"

import Link from "next/link"
import { useId, useState, type ReactNode } from "react"

import { refundableAmount } from "@/lib/billing"
import { formatDateTime, formatMoney, statusLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import type { BillingOrderDetail } from "@/lib/types"
import { useMutation, useResource } from "@/lib/use-api"

import { ReasonedAction } from "../reasoned-action"
import { useSession } from "../session-provider"
import {
  ActionError,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Section,
  Table,
  inputClass,
} from "../ui"
import { IncidentCard, RefundCard } from "./billing-lists"

type DetailPayment = BillingOrderDetail["payments"][number]

const ZERO = BigInt(0)

/**
 * Diagnostic d'une commande. Aucune action ne déclare un paiement réussi :
 * seule la confirmation du prestataire (notification signée ou interrogation)
 * fait évoluer l'état.
 */
export function OrderDetail({ orderId }: { orderId: string }) {
  const order = useResource<BillingOrderDetail>(
    `/admin/billing/orders/${orderId}`,
  )
  if (order.status === "loading") return <Loading />
  if (order.status === "error") {
    return <ErrorState error={order.error} onRetry={order.reload} />
  }
  const data = order.data
  return (
    <>
      <PageHeader
        title={`Commande · ${data.product.name}`}
        description="Contenu figé à la création. Un paiement n'est réussi qu'après confirmation du prestataire."
      />
      <div className="flex flex-col gap-4">
        <Section title="Commande">
          <dl className="grid gap-2 text-sm md:grid-cols-3">
            <Item label="Statut">
              <Badge value={data.status} />
            </Item>
            <Item label="Type">{statusLabel(data.kind)}</Item>
            <Item label="Client">
              <Link href={`/users/${data.buyer.id}`} className="underline">
                {data.buyer.name ?? "Compte"}
              </Link>
            </Item>
            <Item label="Montant figé">
              {formatMoney(data.amount, data.currency)}
            </Item>
            <Item label="Durée">{data.intervalMonths} mois</Item>
            <Item label="Annonces actives max.">
              {data.maxActiveListings ?? "Illimité"}
            </Item>
            <Item label="Créée">{formatDateTime(data.createdAt)}</Item>
            <Item label="Expire">{formatDateTime(data.expiresAt)}</Item>
            <Item label="Payée">{formatDateTime(data.paidAt)}</Item>
            <Item label="Droit accordé">
              {data.fulfilled ? (
                "Oui"
              ) : data.status === "PAID" ? (
                <span className="font-medium text-red-700">
                  Non : la réconciliation retentera l’attribution
                </span>
              ) : (
                "Non"
              )}
            </Item>
            {data.period ? (
              <Item label="Période accordée">
                {formatDateTime(data.period.periodStart)} →{" "}
                {formatDateTime(data.period.periodEnd)}
                {data.period.revokedAt
                  ? ` (révoquée le ${formatDateTime(data.period.revokedAt)})`
                  : ""}
              </Item>
            ) : null}
          </dl>
        </Section>

        <Section title="Tentatives de paiement">
          {data.payments.length === 0 ? (
            <EmptyState>Aucune tentative.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {data.payments.map((payment) => (
                <PaymentBlock
                  key={payment.id}
                  payment={payment}
                  onDone={order.reload}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Incidents">
          {data.incidents.length === 0 ? (
            <EmptyState>Aucun incident.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.incidents.map((incident) => (
                <li
                  key={incident.id}
                  className="rounded-md border border-border p-3"
                >
                  <IncidentCard incident={incident} onDone={order.reload} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function PaymentBlock({
  payment,
  onDone,
}: {
  payment: DetailPayment
  onDone: () => void
}) {
  const {
    state: { me },
  } = useSession()
  const check = useMutation()
  const refundable = refundableAmount(payment)

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge value={payment.status} />
        <span className="tabular-nums">
          {formatMoney(payment.amount, payment.currency)}
        </span>
        <span className="text-xs text-muted-foreground">
          {payment.provider} ·{" "}
          {payment.environment === "TEST"
            ? "test (aucun encaissement réel)"
            : "réel"}
        </span>
        {payment.failureCode ? (
          <span className="font-mono text-xs text-muted-foreground">
            {payment.failureCode}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Créée le {formatDateTime(payment.createdAt)} · réussie le{" "}
        {formatDateTime(payment.succeededAt)} · remboursé{" "}
        {formatMoney(payment.refundedAmount, payment.currency)} ·{" "}
        {payment.checkAttempts} vérification(s), dernière le{" "}
        {formatDateTime(payment.lastCheckedAt)}
      </p>

      {can(me, "billing:reconcile") &&
      (payment.status === "CREATED" || payment.status === "PENDING") ? (
        <div className="mt-2 flex flex-col gap-1">
          <div>
            <Button
              variant="secondary"
              disabled={check.pending}
              onClick={async () => {
                const result = await check.run(
                  `/admin/billing/payments/${payment.id}/check`,
                  undefined,
                )
                if (result.ok) onDone()
              }}
            >
              {check.pending ? "Interrogation…" : "Interroger le prestataire"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Relit l’état chez le prestataire ; ne peut pas déclarer le paiement
            réussi.
          </p>
          <ActionError error={check.error} />
        </div>
      ) : null}

      {can(me, "billing:refund_request") && refundable > ZERO ? (
        <div className="mt-3">
          <RefundRequestForm
            paymentId={payment.id}
            currency={payment.currency}
            refundable={refundable}
            onDone={onDone}
          />
        </div>
      ) : null}

      {payment.refunds.length > 0 ? (
        <div className="mt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Remboursements
          </h3>
          <ul className="flex flex-col gap-2">
            {payment.refunds.map((refund) => (
              <li key={refund.id} className="rounded-md bg-muted/60 p-3">
                <RefundCard refund={refund} onDone={onDone} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {payment.events.length > 0 ? (
        <div className="mt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Notifications reçues du prestataire
          </h3>
          <Table
            headers={[
              "Reçue",
              "Événement",
              "Signature",
              "Résultat",
              "Réceptions",
            ]}
          >
            {payment.events.map((event) => (
              <tr key={`${event.provider}-${event.eventId}`}>
                <td className="px-3 py-2 text-xs">
                  {formatDateTime(event.receivedAt)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{event.eventId}</td>
                <td className="px-3 py-2 text-xs">
                  {event.signatureValid ? "Valide" : "Invalide"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {statusLabel(event.outcome)}
                  {event.errorCode ? ` · ${event.errorCode}` : ""}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {event.attempts}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </div>
  )
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

function RefundRequestForm({
  paymentId,
  currency,
  refundable,
  onDone,
}: {
  paymentId: string
  currency: string
  refundable: bigint
  onDone: () => void
}) {
  const id = useId()
  const request = useMutation()
  const [amount, setAmount] = useState("")
  // Conservée entre deux essais pour qu'un double envoi ne crée qu'une demande.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const trimmed = amount.trim()
  const invalid =
    trimmed !== "" &&
    (!/^[1-9]\d{0,12}$/.test(trimmed) || BigInt(trimmed) > refundable)

  return (
    <ReasonedAction
      label="Demander un remboursement"
      description={`Remboursable : ${formatMoney(refundable.toString(), currency)}. Un second agent habilité devra valider ; le prestataire confirme l'exécution.`}
      minLength={10}
      pending={request.pending}
      error={request.error}
      onSubmit={async (reason) => {
        if (invalid) return false
        const result = await request.run(
          `/admin/billing/payments/${paymentId}/refunds`,
          {
            ...(trimmed ? { amount: trimmed } : {}),
            reason,
            idempotencyKey,
          },
        )
        if (result.ok) {
          setAmount("")
          setIdempotencyKey(newIdempotencyKey())
          onDone()
        }
        return result.ok
      }}
    >
      <Field
        label={`Montant (${currency}, vide = totalité du remboursable)`}
        htmlFor={`${id}-amount`}
        hint={
          invalid ? "Montant invalide ou supérieur au remboursable." : undefined
        }
      >
        <input
          id={`${id}-amount`}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={inputClass}
        />
      </Field>
    </ReasonedAction>
  )
}
