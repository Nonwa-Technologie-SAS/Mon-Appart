import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

export function GuideArticle({
  title,
  lead,
  children,
}: {
  title: string
  lead: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
      <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Accueil
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">Guides</span>
      </nav>
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        Mon Appart
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{lead}</p>
      <div className="prose prose-neutral mt-8 max-w-none space-y-4 text-foreground/90 [&_h2]:scroll-mt-24">
        {children}
      </div>
      <p className="mt-10 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Ces pages sont informatives. Elles ne remplacent pas un conseil
        juridique, notarial ou fiscal. Vérifiez toujours les règles applicables
        à votre cas.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          className="min-h-11"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Rechercher un logement
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          nativeButton={false}
          render={<Link href="/locations" />}
        >
          Voir les locations
        </Button>
      </div>
    </main>
  )
}
