import Link from "next/link"

import { SignOutButton } from "@/components/espace/sign-out-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  isPublisherRole,
  requireAuthPage,
} from "@/lib/auth-session"
import { Role, VisitStatus } from "@/lib/domain-enums"
import { listNestAppointments } from "@/lib/nest-appointments"

function roleLabel(role: string) {
  switch (role) {
    case Role.OWNER:
      return "Propriétaire"
    case Role.AGENCY:
      return "Agence"
    case Role.AGENT:
      return "Agent"
    case Role.ADMIN:
    case Role.SUPERADMIN:
      return "Administration"
    case Role.TENANT:
      return "Locataire"
    case Role.CUSTOMER:
      return "Compte"
    default:
      return role
  }
}

function visitDateLabel(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function visitStatusLabel(status: string) {
  if (status === VisitStatus.ACCEPTED || status === VisitStatus.CONFIRMED) {
    return "Confirmée"
  }
  if (status === VisitStatus.DECLINED || status === VisitStatus.CANCELLED) {
    return "Annulée"
  }
  if (status === VisitStatus.PENDING || status === "PENDING") return "En attente"
  return status
}

export default async function ProfilPage() {
  const session = await requireAuthPage("/profil")
  const publisher = isPublisherRole(session.user.role)
  const appointments = await listNestAppointments()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-10 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Mon profil
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {session.user.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Gérez votre compte Mon Appart
            {session.user.email ? ` · ${session.user.email}` : ""}.
          </p>
        </div>
        <SignOutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Identité liée à votre session Nest.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <span className="text-muted-foreground">Nom</span>
            <span className="font-medium text-right">{session.user.name}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium text-right">
              {session.user.email || "Non renseigné"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Rôle</span>
            <span className="font-medium text-right">
              {roleLabel(session.user.role)}
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {publisher ? (
            <>
              <Button
                nativeButton={false}
                render={<Link href="/espace" />}
              >
                Mon espace publication
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/espace/publier" />}
              >
                Publier un bien
              </Button>
            </>
          ) : (
            <>
              <Button
                nativeButton={false}
                render={<Link href="/inscription/proprietaire" />}
              >
                Devenir propriétaire
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/locations" />}
              >
                Voir les locations
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Mes demandes de visite</h2>
          <p className="text-sm text-muted-foreground">
            {appointments.length} à venir
          </p>
        </div>
        {appointments.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucune visite planifiée</CardTitle>
              <CardDescription>
                Les demandes que vous envoyez depuis une annonce apparaîtront
                ici.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/locations" />}
              >
                Parcourir les annonces
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((item) => (
              <Card key={item.id} className="py-4">
                <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.listing?.title ?? "Annonce"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {visitDateLabel(item.scheduledAt)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {visitStatusLabel(item.status)}
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
