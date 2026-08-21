import Link from "next/link"

import { SignOutButton } from "@/components/espace/sign-out-button"
import { PropertyStatusToggle } from "@/components/espace/property-status-toggle"
import { PropertyCard } from "@/components/site/property-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePublisherPage } from "@/lib/auth-session"
import { formatPropertyStatus } from "@/lib/format"
import { listPropertiesByUserId } from "@/lib/properties"
import { listVisitsForOwner } from "@/lib/visits"
import { PropertyStatus, Role, VisitStatus } from "@/prisma/generated/client/enums"

function visitDateLabel(value: Date) {
  return value.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function visitStatusLabel(status: VisitStatus) {
  if (status === VisitStatus.ACCEPTED) return "Acceptée"
  if (status === VisitStatus.DECLINED) return "Refusée"
  return "En attente"
}

function spaceLabel(role: unknown) {
  if (role === Role.AGENCY) return "Espace agence"
  if (role === Role.OWNER) return "Espace propriétaire"
  return "Espace de publication"
}

export default async function PublisherSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string }>
}) {
  const sessionPromise = requirePublisherPage("/espace")
  const paramsPromise = searchParams
  const session = await sessionPromise
  const [params, properties, visits] = await Promise.all([
    paramsPromise,
    listPropertiesByUserId(session.user.id),
    listVisitsForOwner(session.user.id),
  ])

  const pendingVisits = visits.filter((visit) => visit.status === "PENDING")

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-10 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            {spaceLabel(session.user.role)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Bonjour {session.user.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Publiez vos biens, suivez les visites et retirez une annonce dès
            qu’un logement est pris.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/espace/publier" />}
          >
            Publier un bien
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

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold sm:text-2xl">Mes biens</h2>
          <p className="text-sm text-muted-foreground">
            {properties.length} annonce{properties.length > 1 ? "s" : ""}
          </p>
        </div>
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
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => {
              const available = property.status === PropertyStatus.AVAILABLE

              return (
                <div key={property.id} className="flex min-w-0 flex-col gap-2">
                  <div className="relative min-w-0">
                    <div className={available ? undefined : "opacity-70"}>
                      <PropertyCard property={property} compact />
                    </div>
                    <span
                      className={
                        available
                          ? "absolute top-2 left-2 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                          : "absolute top-2 left-2 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {formatPropertyStatus(property.status)}
                    </span>
                  </div>
                  <PropertyStatusToggle
                    propertyId={property.id}
                    status={property.status}
                  />
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Demandes de visite
          </h2>
          <p className="text-sm text-muted-foreground">
            {pendingVisits.length} en attente
          </p>
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
            {visits.map((visit) => (
              <Card key={visit.id} className="py-4">
                <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {visit.visitorName || "Visiteur"} · {visit.property.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {visitDateLabel(visit.visitDate)} · WhatsApp{" "}
                      {visit.visitorWhatsapp}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {visitStatusLabel(visit.status)}
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
