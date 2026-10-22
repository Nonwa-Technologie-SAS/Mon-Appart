"use client"

import type { RoleView } from "@/lib/types"
import { useResource } from "@/lib/use-api"

import { EmptyState, ErrorState, Loading, PageHeader, Section } from "./ui"

export function RolesView() {
  const roles = useResource<RoleView[]>("/admin/roles")

  return (
    <>
      <PageHeader
        title="Rôles et permissions"
        description="Lecture seule. Les rôles s'attribuent depuis la fiche d'un compte ; nul ne modifie ses propres rôles, et ADMIN / SUPER_ADMIN sont réservés au SUPER_ADMIN."
      />
      {roles.status === "loading" ? <Loading /> : null}
      {roles.status === "error" ? (
        <ErrorState error={roles.error} onRetry={roles.reload} />
      ) : null}
      {roles.status === "ready" ? (
        roles.data.length === 0 ? (
          <EmptyState>Aucun rôle défini.</EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {roles.data.map((role) => (
              <Section key={role.code} title={`${role.name} (${role.code})`}>
                {role.description ? (
                  <p className="mb-2 text-sm text-stone-600">
                    {role.description}
                  </p>
                ) : null}
                {role.code === "SUPER_ADMIN" ? (
                  <p className="text-sm">Toutes les permissions.</p>
                ) : role.permissions.length === 0 ? (
                  <p className="text-sm text-stone-600">Aucune permission.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                      <li
                        key={permission}
                        className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs"
                      >
                        {permission}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ))}
          </div>
        )
      ) : null}
    </>
  )
}
