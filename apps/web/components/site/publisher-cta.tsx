import Link from "next/link"

import { Button } from "@/components/ui/button"

/** Appel à l’action propriétaires / agences — parcours réel d’inscription. */
export function PublisherCta() {
  return (
    <section
      aria-labelledby="publisher-cta-title"
      className="overflow-hidden rounded-2xl border border-border bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2
            id="publisher-cta-title"
            className="text-lg font-semibold sm:text-xl"
          >
            Vous avez un bien à louer ?
          </h2>
          <p className="mt-1 text-sm text-primary-foreground/85 sm:text-base">
            Publiez votre annonce, ajoutez des photos et recevez des demandes
            de visite depuis Mon Appart.
          </p>
        </div>
        <Button
          variant="secondary"
          className="min-h-11 shrink-0"
          nativeButton={false}
          render={<Link href="/inscription/proprietaire" />}
        >
          Publier un bien
        </Button>
      </div>
    </section>
  )
}
