import Link from "next/link"
import { notFound } from "next/navigation"

import { EditPropertyForm } from "@/components/espace/edit-property-form"
import { EspaceNav } from "@/components/espace/espace-nav"
import { Button } from "@/components/ui/button"
import { requirePublisherPage } from "@/lib/auth-session"
import { nestGetOwnedListing } from "@/lib/nest-publish"

export default async function EditOwnedListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  await requirePublisherPage("/espace")
  const { listingId } = await params

  let listing
  try {
    listing = await nestGetOwnedListing(listingId)
  } catch {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:py-14">
      <EspaceNav current="/espace" />
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
          Modifier l&apos;annonce
        </h1>
        <p className="mt-2 text-muted-foreground">
          Mettez à jour les informations visibles par les visiteurs. Le type de
          bien et les photos se gèrent séparément pour l&apos;instant.
        </p>
      </div>
      <EditPropertyForm listing={listing} />
    </main>
  )
}
