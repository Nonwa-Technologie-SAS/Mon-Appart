import type { Metadata } from "next"
import Link from "next/link"

import { RecommendationsPanel } from "@/components/site/recommendations-panel"
import { Button } from "@/components/ui/button"
import { isWebFeatureEnabled } from "@/lib/feature-flags"

export const metadata: Metadata = {
  title: "Suggestions pour vous",
  description:
    "Recommandations immobilières personnalisées Mon Appart — contraintes strictes, explications vérifiables, sans annonces inventées.",
}

export default function PourVousPage() {
  if (!isWebFeatureEnabled("recommendations")) {
    return (
      <main className="container-content py-8 sm:py-12">
        <h1 className="text-2xl font-semibold">Suggestions indisponibles</h1>
        <p className="mt-3 text-muted-foreground">
          Les recommandations sont temporairement désactivées.
        </p>
        <Button
          className="mt-6"
          nativeButton={false}
          render={<Link href="/locations" />}
        >
          Recherche classique
        </Button>
      </main>
    )
  }

  return (
    <main className="container-content py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm font-medium text-primary">Mon Appart</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pour vous
        </h1>
        <p className="mt-3 text-muted-foreground">
          Suggestions fondées sur vos préférences déclarées et, si disponibles,
          sur votre activité récente. Le budget et les filtres obligatoires ne
          sont jamais contournés par un score.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/locations" />}
          >
            Recherche classique
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/assistant" />}
          >
            Assistant
          </Button>
        </div>
      </header>
      <RecommendationsPanel />
    </main>
  )
}
