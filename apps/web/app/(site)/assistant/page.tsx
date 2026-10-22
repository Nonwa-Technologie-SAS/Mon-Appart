import type { Metadata } from "next"
import Link from "next/link"

import { AssistantChat } from "@/components/site/assistant-chat"
import { Button } from "@/components/ui/button"
import { isWebFeatureEnabled } from "@/lib/feature-flags"

export const metadata: Metadata = {
  title: "Assistant immobilier",
  description:
    "Recherchez un logement en Côte d’Ivoire en langage naturel. L’assistant Mon Appart clarifie vos critères et interroge les annonces réellement publiées.",
  robots: { index: true, follow: true },
}

export default function AssistantPage() {
  if (!isWebFeatureEnabled("assistant")) {
    return (
      <main className="container-content py-8 sm:py-12">
        <h1 className="text-2xl font-semibold">Assistant indisponible</h1>
        <p className="mt-3 text-muted-foreground">
          Cette fonctionnalité est temporairement désactivée. Utilisez la
          recherche classique.
        </p>
        <Button
          className="mt-6"
          nativeButton={false}
          render={<Link href="/locations" />}
        >
          Voir les locations
        </Button>
      </main>
    )
  }

  return (
    <main className="container-content py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm font-medium text-primary">Mon Appart</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Assistant immobilier
        </h1>
        <p className="mt-3 text-muted-foreground">
          Décrivez ce que vous cherchez en français. Nous transformons votre
          demande en filtres vérifiés, puis affichons uniquement des annonces
          disponibles sur la plateforme.
        </p>
      </header>
      <AssistantChat />
    </main>
  )
}
