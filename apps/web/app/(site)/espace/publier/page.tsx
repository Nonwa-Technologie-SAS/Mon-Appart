import Link from "next/link"

import { PublishPropertyForm } from "@/components/espace/publish-property-form"
import { Button } from "@/components/ui/button"
import { requirePublisherPage } from "@/lib/auth-session"

export default async function PublishPropertyPage() {
  await requirePublisherPage("/espace/publier")

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:py-14">
      <div>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/espace" />}
          className="mb-4 -ml-2"
        >
          ← Retour à mon espace
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Publier un bien
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ajoutez vos photos et indiquez dans quelle pièce chacune se trouve.
          La visite en ligne suivra ce parcours.
        </p>
      </div>
      <PublishPropertyForm />
    </main>
  )
}
