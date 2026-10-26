import Link from "next/link"

import { SignOutButton } from "@/components/espace/sign-out-button"
import {
  NotificationPreferencesForm,
  ProjectStatusForm,
  SavedSearchActions,
  VisitFeedbackForm,
} from "@/components/site/retention-panels"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isPublisherRole, requireAuthPage } from "@/lib/auth-session"
import { Role, VisitStatus } from "@/lib/domain-enums"
import { listNestAppointments } from "@/lib/nest-appointments"
import { listNestFavorites } from "@/lib/nest-favorites"
import { getInquiryDashboard } from "@/lib/nest-inquiries"
import { getNestNotificationPreferences } from "@/lib/nest-notification-preferences"
import { nestServerFetch } from "@/lib/nest-session"
import {
  getNestProjectStatus,
  listNestSavedSearches,
} from "@/lib/nest-saved-searches"

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
  if (status === VisitStatus.PENDING || status === "PENDING")
    return "En attente"
  if (status === "COMPLETED") return "Réalisée"
  return status
}

async function unreadNotifications(): Promise<number> {
  try {
    const result = await nestServerFetch<{ unread: number }>(
      "/notifications/unread-count",
    )
    return result.unread ?? 0
  } catch {
    return 0
  }
}

export default async function ProfilPage() {
  const session = await requireAuthPage("/profil")
  const publisher = isPublisherRole(session.user.role)
  const [
    appointments,
    savedSearches,
    favorites,
    project,
    preferenceCells,
    unread,
    inquiryDashboard,
  ] = await Promise.all([
    listNestAppointments("all"),
    listNestSavedSearches(),
    listNestFavorites(),
    getNestProjectStatus(),
    getNestNotificationPreferences(),
    unreadNotifications(),
    publisher ? getInquiryDashboard() : Promise.resolve(null),
  ])

  const upcoming = appointments.filter(
    (item) =>
      item.side === "REQUESTER" &&
      (item.status === "PENDING" ||
        item.status === "CONFIRMED" ||
        item.status === VisitStatus.ACCEPTED),
  )
  const completedWithoutFeedback = appointments.filter(
    (item) =>
      item.side === "REQUESTER" &&
      item.status === "COMPLETED" &&
      !item.feedback?.submitted,
  )
  const completedVisits = appointments.filter(
    (item) => item.side === "REQUESTER" && item.status === "COMPLETED",
  )

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
            Reprenez votre recherche là où vous l’avez laissée
            {session.user.email ? ` · ${session.user.email}` : ""}.
          </p>
        </div>
        <SignOutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>À faire maintenant</CardTitle>
          <CardDescription>
            Un résumé compact : uniquement ce qui peut vous faire avancer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {upcoming.length > 0 ? (
            <p>
              {upcoming.length} visite(s) à venir.{" "}
              <Link className="text-primary underline" href="#visites">
                Voir
              </Link>
            </p>
          ) : null}
          {completedWithoutFeedback.length > 0 ? (
            <p>
              {completedWithoutFeedback.length} visite(s) réalisée(s) sans
              retour — facultatif.
            </p>
          ) : null}
          {savedSearches.length > 0 ? (
            <p>
              {savedSearches.length} recherche(s) enregistrée(s).{" "}
              <Link className="text-primary underline" href="#recherches">
                Reprendre
              </Link>
            </p>
          ) : null}
          {favorites.length > 0 ? (
            <p>
              {favorites.length} favori(s).{" "}
              <Link className="text-primary underline" href="/favoris">
                Ouvrir
              </Link>
            </p>
          ) : null}
          {unread > 0 ? <p>{unread} notification(s) non lue(s).</p> : null}
          {project.projectStatus === "COMPLETED" ? (
            <p>
              Votre projet est marqué comme terminé : les alertes de recherche
              sont en pause.
            </p>
          ) : null}
          {upcoming.length === 0 &&
          savedSearches.length === 0 &&
          favorites.length === 0 &&
          unread === 0 ? (
            <p className="text-muted-foreground">
              Rien d’urgent. Enregistrez une recherche ou un favori pour
              reprendre plus facilement.
            </p>
          ) : null}
        </CardContent>
      </Card>

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
              <Button nativeButton={false} render={<Link href="/espace" />}>
                Mon espace publication
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/espace/demandes" />}
              >
                Demandes à traiter
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
                render={<Link href="/" />}
              >
                Voir les annonces
              </Button>
            </>
          )}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/favoris" />}
          >
            Mes favoris
          </Button>
        </div>
      </section>

      {publisher && inquiryDashboard ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Suivi commercial</h2>
          <Card>
            <CardHeader>
              <CardTitle>Actions utiles</CardTitle>
              <CardDescription>
                Chiffres issus du CRM existant, limités aux demandes que vous
                pouvez voir. Un volume de vues n’est pas une preuve de
                performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{inquiryDashboard.unhandled} demande(s) sans réponse.</p>
              <p>
                {inquiryDashboard.overdueActions} action(s) en retard ·{" "}
                {inquiryDashboard.confirmedUpcomingVisits} visite(s)
                confirmée(s).
              </p>
              {inquiryDashboard.responseRate !== null ? (
                <p>
                  Taux de première réponse :{" "}
                  {Math.round(inquiryDashboard.responseRate * 100)} %
                  {inquiryDashboard.medianFirstResponseHours !== null
                    ? ` · médiane ${inquiryDashboard.medianFirstResponseHours} h`
                    : ""}
                  .
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Pas encore assez de données pour un délai de réponse fiable.
                </p>
              )}
              <Link className="text-primary underline" href="/espace/demandes">
                Ouvrir le CRM
              </Link>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section id="recherches" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Recherches enregistrées</h2>
        {savedSearches.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucune recherche enregistrée</CardTitle>
              <CardDescription>
                Enregistrez des critères depuis les résultats vides pour
                recevoir un résumé des nouvelles annonces compatibles.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {savedSearches.map((search) => (
              <Card key={search.id} className="py-4">
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">{search.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {search.alertsEnabled
                        ? "Alertes actives"
                        : "Alertes en pause"}
                      {search.maxPrice
                        ? ` · budget max ${search.maxPrice.toLocaleString("fr-FR")} ${search.currency}`
                        : ""}
                    </p>
                  </div>
                  <SavedSearchActions search={search} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="visites" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Mes visites</h2>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} à venir
          </p>
        </div>
        {appointments.filter((item) => item.side === "REQUESTER").length ===
        0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucune visite planifiée</CardTitle>
              <CardDescription>
                Les demandes que vous envoyez depuis une annonce apparaîtront
                ici.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments
              .filter((item) => item.side === "REQUESTER")
              .slice(0, 12)
              .map((item) => (
                <Card key={item.id} className="py-4">
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
                        {item.feedback?.submitted ? " · retour envoyé" : ""}
                      </p>
                    </div>
                    {item.listing?.id ? (
                      <Link
                        className="text-sm text-primary underline"
                        href={`/annonces/${item.listing.id}`}
                      >
                        Revoir l’annonce
                      </Link>
                    ) : null}
                    {item.status === "COMPLETED" &&
                    item.side === "REQUESTER" &&
                    !item.feedback?.submitted ? (
                      <VisitFeedbackForm appointmentId={item.id} />
                    ) : null}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </section>

      {completedVisits.length >= 2 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Comparer les biens visités</h2>
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-medium">Bien</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Votre retour</th>
                  </tr>
                </thead>
                <tbody>
                  {completedVisits.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2">
                        {item.listing?.id ? (
                          <Link
                            className="text-primary underline"
                            href={`/annonces/${item.listing.id}`}
                          >
                            {item.listing.title}
                          </Link>
                        ) : (
                          item.listing?.title
                        )}
                      </td>
                      <td className="py-2">
                        {visitDateLabel(item.scheduledAt)}
                      </td>
                      <td className="py-2">
                        {item.feedback?.outcome ?? "Non renseigné"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Mon projet</h2>
        <Card>
          <CardContent className="pt-6">
            <ProjectStatusForm projectStatus={project.projectStatus} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Préférences de notification</h2>
        <Card>
          <CardContent className="pt-6">
            {preferenceCells.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Préférences indisponibles pour le moment.
              </p>
            ) : (
              <NotificationPreferencesForm cells={preferenceCells} />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
