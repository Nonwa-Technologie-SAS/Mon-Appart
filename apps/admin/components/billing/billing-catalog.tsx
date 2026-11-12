"use client"

import { useId, useState, type FormEvent } from "react"

import { parseQuota } from "@/lib/billing"
import { formatDateTime, formatMoney } from "@/lib/format"
import { can } from "@/lib/permissions"
import type { BillingProduct } from "@/lib/types"
import { useMutation, useResource } from "@/lib/use-api"

import { useSession } from "../session-provider"
import {
  ActionError,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Section,
  inputClass,
} from "../ui"

/**
 * Catalogue configurable. Un nouveau tarif ne modifie jamais une commande
 * existante : le montant y est figé à la création.
 */
export function BillingCatalog() {
  const {
    state: { me },
  } = useSession()
  const catalog = useResource<BillingProduct[]>("/admin/billing/catalog")
  const canEdit = can(me, "billing:catalog")

  if (catalog.status === "loading") return <Loading />
  if (catalog.status === "error") {
    return <ErrorState error={catalog.error} onRetry={catalog.reload} />
  }
  return (
    <div className="flex flex-col gap-4">
      {canEdit ? <CreateProductForm onDone={catalog.reload} /> : null}
      {catalog.data.length === 0 ? (
        <EmptyState>Aucun plan configuré.</EmptyState>
      ) : (
        catalog.data.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            canEdit={canEdit}
            onDone={catalog.reload}
          />
        ))
      )}
    </div>
  )
}

function CreateProductForm({ onDone }: { onDone: () => void }) {
  const id = useId()
  const create = useMutation()
  const [quotaError, setQuotaError] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const quota = parseQuota(String(data.get("maxActiveListings") ?? ""))
    setQuotaError(quota === undefined)
    if (quota === undefined) return
    const description = String(data.get("description") ?? "").trim()
    const result = await create.run("/admin/billing/catalog/products", {
      code: String(data.get("code") ?? "").trim(),
      name: String(data.get("name") ?? "").trim(),
      ...(description ? { description } : {}),
      maxActiveListings: quota,
    })
    if (result.ok) {
      form.reset()
      onDone()
    }
  }

  return (
    <Section title="Nouveau plan (brouillon)">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label="Code (MAJUSCULES)" htmlFor={`${id}-code`}>
          <input
            id={`${id}-code`}
            name="code"
            required
            pattern="[A-Z][A-Z0-9_]{1,63}"
            className={inputClass}
          />
        </Field>
        <Field label="Nom" htmlFor={`${id}-name`}>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="Description" htmlFor={`${id}-description`}>
          <input
            id={`${id}-description`}
            name="description"
            maxLength={500}
            className={inputClass}
          />
        </Field>
        <Field
          label="Annonces actives max. (vide = illimité)"
          htmlFor={`${id}-quota`}
        >
          <input
            id={`${id}-quota`}
            name="maxActiveListings"
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2 flex flex-col gap-2">
          {quotaError ? (
            <p role="alert" className="text-sm text-red-700">
              Quota invalide : entier positif ou champ vide.
            </p>
          ) : null}
          <ActionError error={create.error} />
          <div>
            <Button type="submit" disabled={create.pending}>
              {create.pending ? "Envoi…" : "Créer le plan"}
            </Button>
          </div>
        </div>
      </form>
    </Section>
  )
}

function ProductCard({
  product,
  canEdit,
  onDone,
}: {
  product: BillingProduct
  canEdit: boolean
  onDone: () => void
}) {
  const update = useMutation()
  const archive = useMutation()
  const path = `/admin/billing/catalog/products/${product.code}`

  async function setStatus(status: "ACTIVE" | "RETIRED") {
    const result = await update.run(path, { status }, "PATCH")
    if (result.ok) onDone()
  }

  return (
    <Section title={product.name}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs">{product.code}</span>
        <Badge value={product.status} />
        {product.isDefault ? (
          <span className="text-xs">Plan par défaut (gratuit)</span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Annonces actives max. : {product.maxActiveListings ?? "illimité"}
        </span>
      </div>
      {product.description ? (
        <p className="mt-1 text-sm">{product.description}</p>
      ) : null}
      <p className="mt-2 text-sm">
        Tarif en vigueur :{" "}
        {product.currentPrice ? (
          <strong className="tabular-nums">
            {formatMoney(
              product.currentPrice.amount,
              product.currentPrice.currency,
            )}{" "}
            / {product.currentPrice.intervalMonths} mois
          </strong>
        ) : (
          "aucun"
        )}
      </p>
      {product.prices.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {product.prices.map((price) => (
            <li key={price.id} className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">
                {formatMoney(price.amount, price.currency)} /{" "}
                {price.intervalMonths} mois
              </span>
              <Badge value={price.status} />
              <span className="text-muted-foreground">
                dès le {formatDateTime(price.validFrom)}
                {price.validUntil
                  ? ` jusqu'au ${formatDateTime(price.validUntil)}`
                  : ""}
              </span>
              {canEdit && price.status === "ACTIVE" ? (
                <Button
                  variant="secondary"
                  disabled={archive.pending}
                  onClick={async () => {
                    const result = await archive.run(
                      `/admin/billing/catalog/prices/${price.id}/archive`,
                      undefined,
                    )
                    if (result.ok) onDone()
                  }}
                >
                  Archiver
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ActionError error={archive.error} />
      {canEdit && !product.isDefault ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {product.status !== "ACTIVE" ? (
              <Button
                disabled={update.pending}
                onClick={() => void setStatus("ACTIVE")}
              >
                Publier le plan
              </Button>
            ) : null}
            {product.status === "ACTIVE" ? (
              <Button
                variant="danger"
                disabled={update.pending}
                onClick={() => void setStatus("RETIRED")}
              >
                Retirer de la vente
              </Button>
            ) : null}
          </div>
          <ActionError error={update.error} />
          <AddPriceForm code={product.code} onDone={onDone} />
        </div>
      ) : null}
    </Section>
  )
}

function AddPriceForm({ code, onDone }: { code: string; onDone: () => void }) {
  const id = useId()
  const create = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const result = await create.run(
      `/admin/billing/catalog/products/${code}/prices`,
      {
        amount: String(data.get("amount") ?? "").trim(),
        currency: "XOF",
        intervalMonths: Number(data.get("intervalMonths")),
      },
    )
    if (result.ok) {
      form.reset()
      onDone()
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field label="Nouveau tarif (XOF, entier)" htmlFor={`${id}-amount`}>
        <input
          id={`${id}-amount`}
          name="amount"
          required
          inputMode="numeric"
          pattern="[1-9][0-9]{0,12}"
          className={inputClass}
        />
      </Field>
      <Field label="Durée (mois)" htmlFor={`${id}-interval`}>
        <input
          id={`${id}-interval`}
          name="intervalMonths"
          type="number"
          min={1}
          max={24}
          defaultValue={1}
          required
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={create.pending}>
        {create.pending ? "Envoi…" : "Ajouter le tarif"}
      </Button>
      <ActionError error={create.error} />
    </form>
  )
}
