import Link from "next/link"

import { HomeHero } from "@/components/site/home-hero"
import { PropertyGrid } from "@/components/site/property-grid"
import { Button } from "@/components/ui/button"
import { getFeaturedProperties } from "@/lib/properties"

export default async function HomePage() {
  const properties = await getFeaturedProperties()

  return (
    <>
      <HomeHero />
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              À découvrir
            </h2>
            <p className="mt-2 text-muted-foreground">
              Une sélection de biens disponibles dès maintenant.
            </p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/recherche" />}
          >
            Voir toutes les annonces
          </Button>
        </div>
        <PropertyGrid properties={properties} />
      </section>
    </>
  )
}
