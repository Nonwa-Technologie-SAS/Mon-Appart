import Link from "next/link"

import {
  CrmDashboardCards,
  CrmTopListings,
} from "@/components/espace/crm-dashboard-cards"
import { EspaceNav } from "@/components/espace/espace-nav"
import { OwnedPropertiesPanel } from "@/components/espace/owned-properties-panel"
import { listNestAppointments } from "@/lib/nest-appointments"
import { getInquiryDashboard } from "@/lib/nest-inquiries"
import { SignOutButton } from "@/components/espace/sign-out-button"
import { PublisherAnalytics } from "@/components/site/publisher-analytics"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePublisherPage } from "@/lib/auth-session"
import { formatCiDateTime, VISIT_STATUS_LABELS } from "@/lib/crm-labels"
import { Role } from "@/lib/domain-enums"
import { listPropertiesByUserId } from "@/lib/properties"

function spaceLabel(role: unknown) {
  if (role === Role.AGENCY) return "Espace agence"
  if (role === Role.OWNER) return "Espace propriétaire"
  if (role === Role.AGENT) return "Espace agent"
  return "Espace de publication"
}

export default async function PublisherSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string; updated?: string }>
}) {
  const session = await requirePublisherPage("/espace")
  const [params, properties, nestAppointments, dashboard] = await Promise.all([
    searchParams,
    listPropertiesByUserId(session.user.id),
    listNestAppointments("upcoming"),
    getInquiryDashboard(),
  ])

  const visits = nestAppointments.filter((item) => item.side === "LISTING_SIDE")
  const pendingVisits = visits.filter((visit) => visit.status === "PENDING")

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-10 lg:py-14">
      <EspaceNav current="/espace" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            {spaceLabel(session.user.role)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Bonjour {session.user.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Publiez vos biens, suivez les visites et vérifiez votre identité
            pour renforcer la confiance. Une annonce complète (photos, prix en
            FCFA, localisation exacte) convertit mieux qu’un volume élevé
            d’annonces incomplètes.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            className="min-h-11 w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/espace/publier" />}
          >
            Publier un bien
          </Button>
          <Button
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/espace/verification" />}
          >
            Vérifier mon compte
          </Button>
          <SignOutButton />
        </div>
      </div>

      {params.published === "1" ? (
        <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          Votre bien est en ligne. Il apparaît maintenant dans les recherches.
          Vous pouvez le masquer à tout moment s’il est pris.
        </p>
      ) : null}
      {params.updated === "1" ? (
        <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          Annonce mise à jour. Les visiteurs verront les nouvelles informations.
        </p>
      ) : null}

      {dashboard ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold sm:text-2xl">
              Activité commerciale
            </h2>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/espace/demandes" />}
            >
              Voir les demandes
            </Button>
          </div>
          <CrmDashboardCards data={dashboard} />
          <CrmTopListings items={dashboard.topListings ?? []} />
        </section>
      ) : null}

      <PublisherAnalytics />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold sm:text-2xl">Mes biens</h2>
        {properties.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucun bien publié</CardTitle>
              <CardDescription>
                Ajoutez votre première maison, appartement ou villa pour la
                rendre visible aux visiteurs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                nativeButton={false}
                render={<Link href="/espace/publier" />}
              >
                Publier un bien
              </Button>
            </CardContent>
          </Card>
        ) : (
          <OwnedPropertiesPanel properties={properties} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold sm:text-2xl">Visites à venir</h2>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/espace/visites" />}
          >
            {pendingVisits.length} en attente
          </Button>
        </div>
        {visits.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pas encore de demande</CardTitle>
              <CardDescription>
                Les visiteurs intéressés apparaîtront ici après une demande de
                visite.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {visits.slice(0, 5).map((visit) => (
              <Card key={visit.id} className="py-4">
                <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {visit.requester?.displayName ?? "Visiteur"} ·{" "}
                      {visit.listing?.title ?? "Annonce"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCiDateTime(visit.scheduledAt)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
