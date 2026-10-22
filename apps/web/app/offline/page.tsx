import type { Metadata } from "next"
import Link from "next/link"

import { BrandMark } from "@/components/site/brand-mark"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
}

/**
 * Fallback navigateur lorsque le réseau est indisponible.
 * Précaché par le service worker — pas de données inventées.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-12 surface-hero">
      <BrandMark href="/" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--elevation-md)] sm:p-8">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Connexion indisponible
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Vérifiez votre réseau mobile ou Wi‑Fi, puis réessayez. Les annonces
          et actions (visite, publication, compte) nécessitent une connexion
          au serveur — rien n’est inventé hors ligne.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Retour à l&apos;accueil
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/guides/eviter-les-arnaques" />}
          >
            Guide anti-arnaques
          </Button>
        </div>
      </div>
    </main>
  )
}
