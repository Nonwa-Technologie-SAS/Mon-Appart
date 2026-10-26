import Link from "next/link"

import { ContactVerifyPanel } from "@/components/espace/contact-verify-panel"
import { EspaceNav } from "@/components/espace/espace-nav"
import { StartVerificationForm } from "@/components/espace/start-verification-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePublisherPage } from "@/lib/auth-session"
import { nestListMine } from "@/lib/nest-publish"
import { nestServerFetch } from "@/lib/nest-session"
import type { NestUser } from "@/lib/nest-session"
import {
  getUserBadges,
  listMyVerifications,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_TYPE_LABELS,
} from "@/lib/nest-trust"

export default async function VerificationHubPage() {
  const session = await requirePublisherPage("/espace/verification")
  const [verifications, listings, me, badges] = await Promise.all([
    listMyVerifications().catch(() => []),
    nestListMine().catch(() => []),
    nestServerFetch<NestUser>("/auth/me").catch(() => null),
    getUserBadges(session.user.id).catch(() => []),
  ])

  const properties = listings
    .filter((item) => item.property?.id)
    .map((item) => ({
      propertyId: item.property.id,
      title: item.title,
    }))

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <EspaceNav current="/espace/verification" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Confiance
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Vérifier mon compte
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            E-mail, téléphone, identité et agence. Les dossiers sont examinés
            par un humain ; ce n’est pas une certification juridique.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          nativeButton={false}
          render={<Link href="/espace" />}
        >
          Retour à l’espace
        </Button>
      </div>

      {badges.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Badges obtenus</CardTitle>
            <CardDescription>
              Affichables sur votre profil public. Le score interne reste
              réservé à la modération.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <li
                  key={badge.code}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm"
                >
                  {badge.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>E-mail et téléphone</CardTitle>
          <CardDescription>
            Vérification par code à usage unique (OTP). En local, les messages
            peuvent apparaître dans la console API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactVerifyPanel
            emailVerified={Boolean(me?.emailVerified)}
            phoneVerified={Boolean(me?.phoneVerified)}
            hasEmail={Boolean(me?.email)}
            hasPhone={Boolean(me?.phone)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau dossier</CardTitle>
          <CardDescription>
            Identité (CNI, passeport…), agence, propriété ou mandat. Joignez
            ensuite les pièces, puis soumettez pour examen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StartVerificationForm
            role={session.user.role}
            properties={properties}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Mes dossiers</h2>
        {verifications.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucun dossier</CardTitle>
              <CardDescription>
                Ouvrez une vérification d’identité pour démarrer.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {verifications.map((item) => (
              <li key={item.id}>
                <Card className="py-4">
                  <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {VERIFICATION_TYPE_LABELS[item.type] ?? item.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {VERIFICATION_STATUS_LABELS[item.status] ?? item.status}
                        {" · "}
                        {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      nativeButton={false}
                      render={<Link href={`/espace/verification/${item.id}`} />}
                    >
                      Ouvrir
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
