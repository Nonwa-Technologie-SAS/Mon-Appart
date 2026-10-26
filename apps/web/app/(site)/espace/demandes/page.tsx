import Link from "next/link"

import { EspaceNav } from "@/components/espace/espace-nav"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { requirePublisherPage } from "@/lib/auth-session"
import {
  formatCiDateTime,
  PRIORITY_LABELS,
  STAGE_LABELS,
  STAGE_OPTIONS,
} from "@/lib/crm-labels"
import { listNestInquiries } from "@/lib/nest-inquiries"

export default async function DemandesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    stage?: string
    listingId?: string
    q?: string
    cursor?: string
    assignee?: string
  }>
}) {
  await requirePublisherPage("/espace/demandes")
  const params = await searchParams
  const page = await listNestInquiries({
    ...(params.status ? { status: params.status } : {}),
    ...(params.stage ? { stage: params.stage } : {}),
    ...(params.listingId ? { listingId: params.listingId } : {}),
    ...(params.q ? { q: params.q } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.assignee ? { assignee: params.assignee } : {}),
  })

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <EspaceNav current="/espace/demandes" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demandes reçues</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacts liés à vos annonces. Traitez d’abord les demandes
          prioritaires.
        </p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" method="get">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Rechercher une annonce"
          aria-label="Rechercher une annonce"
        />
        <select
          name="stage"
          defaultValue={params.stage ?? ""}
          className="flex h-11 rounded-lg border border-input bg-background px-3 text-sm"
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {STAGE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {STAGE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="flex h-11 rounded-lg border border-input bg-background px-3 text-sm"
          aria-label="Filtrer par traitement"
        >
          <option value="">Tous</option>
          <option value="OPEN">Non traitées</option>
          <option value="IN_PROGRESS">En cours</option>
        </select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
      {page.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune demande pour le moment</CardTitle>
            <CardDescription>
              Dès qu’un visiteur vous contacte ou demande une visite, la demande
              apparaîtra ici.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {page.items.map((item) => (
            <li key={item.id}>
              <Link href={`/espace/demandes/${item.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.prospect.displayName} · {item.listing.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {STAGE_LABELS[item.stage] ?? item.stage} ·{" "}
                        {formatCiDateTime(item.createdAt)}
                      </p>
                      <p className="mt-1 text-sm">{item.suggestedAction}</p>
                    </div>
                    <p
                      className={
                        item.priority === "HIGH"
                          ? "text-sm font-medium text-destructive"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {PRIORITY_LABELS[item.priority]}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link
              href={`/espace/demandes?${new URLSearchParams({
                ...(params.q ? { q: params.q } : {}),
                ...(params.stage ? { stage: params.stage } : {}),
                ...(params.status ? { status: params.status } : {}),
                cursor: page.nextCursor,
              }).toString()}`}
            />
          }
        >
          Voir plus
        </Button>
      ) : null}
    </main>
  )
}
