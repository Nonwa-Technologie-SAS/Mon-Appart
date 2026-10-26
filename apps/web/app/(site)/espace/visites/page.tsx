import { EspaceNav } from "@/components/espace/espace-nav"
import { VisitActions } from "@/components/espace/visit-actions"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePublisherPage } from "@/lib/auth-session"
import { formatCiDateTime, VISIT_STATUS_LABELS } from "@/lib/crm-labels"
import { listNestAppointments } from "@/lib/nest-appointments"

export default async function VisitesPage() {
  await requirePublisherPage("/espace/visites")
  const visits = (await listNestAppointments("all")).filter(
    (item) => item.side === "LISTING_SIDE",
  )

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <EspaceNav current="/espace/visites" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une visite n’est jamais confirmée automatiquement. Confirmez, proposez
          un autre créneau ou annulez avec un motif.
        </p>
      </div>
      {visits.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune visite</CardTitle>
            <CardDescription>
              Les demandes de visite sur vos annonces apparaîtront ici.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {visits.map((visit) => (
            <li key={visit.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {visit.requester?.displayName ?? "Visiteur"} ·{" "}
                        {visit.listing?.title ?? "Annonce"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {VISIT_STATUS_LABELS[visit.status] ?? visit.status} ·{" "}
                        {formatCiDateTime(visit.scheduledAt)}
                      </p>
                    </div>
                  </div>
                  <VisitActions visit={visit} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
