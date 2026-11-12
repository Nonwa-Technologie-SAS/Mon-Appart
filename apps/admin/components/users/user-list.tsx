"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { useState, type FormEvent } from "react"

import { formatDateTime, formatRoles, roleLabel } from "@/lib/format"
import type { AdminUserSummary } from "@/lib/types"
import { usePagedList } from "@/lib/use-api"

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

const STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "BANNED"]
const ROLES = [
  "CUSTOMER",
  "OWNER",
  "AGENT",
  "AGENCY",
  "MODERATOR",
  "TRUST_OFFICER",
  "SUPPORT",
  "ANALYST",
  "ADMIN",
  "SUPER_ADMIN",
]

interface Filters {
  q: string
  status: string
  role: string
}

export function UserList({ initial }: { initial: Partial<Filters> }) {
  const [filters, setFilters] = useState<Filters>({
    q: initial.q ?? "",
    status: initial.status ?? "",
    role: initial.role ?? "",
  })
  const list = usePagedList<AdminUserSummary>("/admin/users", {
    ...filters,
    limit: 25,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      q: String(form.get("q") ?? "").trim(),
      status: String(form.get("status") ?? ""),
      role: String(form.get("role") ?? ""),
    })
  }

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Coordonnées masquées dans la liste. La recherche par e-mail ou téléphone exige l'habilitation aux données personnelles."
      />
      <form
        onSubmit={onSubmit}
        className="mb-4 flex flex-wrap items-end gap-3"
        role="search"
      >
        <label className="flex flex-col gap-1 text-sm">
          Nom, e-mail ou téléphone
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Statut
          <select
            name="status"
            defaultValue={filters.status}
            className={inputClass}
          >
            <option value="">Tous</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Rôle
          <select
            name="role"
            defaultValue={filters.role}
            className={inputClass}
          >
            <option value="">Tous</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="gap-2">
          <Search aria-hidden className="size-3.5" />
          Rechercher
        </Button>
      </form>

      {list.status === "loading" ? <Loading /> : null}
      {list.status === "error" && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : null}
      {list.status === "ready" ? (
        list.items.length === 0 ? (
          <EmptyState>Aucun compte ne correspond à ces critères.</EmptyState>
        ) : (
          <>
            <Table
              headers={[
                "Nom",
                "E-mail",
                "Téléphone",
                "Statut",
                "Rôles",
                "Inscription",
              ]}
            >
              {list.items.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/users/${user.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {user.name ?? "Sans nom"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {user.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {user.phone ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge value={user.status} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatRoles(user.roles)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatDateTime(user.createdAt)}
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
