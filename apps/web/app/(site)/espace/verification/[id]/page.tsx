import Link from "next/link"
import { notFound } from "next/navigation"

import { VerificationDetailClient } from "@/components/espace/verification-detail-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePublisherPage } from "@/lib/auth-session"
import {
  getMyVerification,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_TYPE_LABELS,
} from "@/lib/nest-trust"

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePublisherPage("/espace/verification")
  const { id } = await params

  let verification
  try {
    verification = await getMyVerification(id)
  } catch {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Dossier
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {VERIFICATION_TYPE_LABELS[verification.type] ?? verification.type}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {VERIFICATION_STATUS_LABELS[verification.status] ??
              verification.status}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          nativeButton={false}
          render={<Link href="/espace/verification" />}
        >
          Tous les dossiers
        </Button>
      </div>

      {verification.reason ? (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          {verification.reason.message}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pièces et soumission</CardTitle>
          <CardDescription>
            Ne transmettez aucun numéro de pièce dans le texte libre. Seul un
            agent de confiance peut approuver le dossier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerificationDetailClient verification={verification} />
        </CardContent>
      </Card>
    </main>
  )
}
