import Link from "next/link"

import { BrandMark } from "@/components/site/brand-mark"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <BrandMark />
      <div className="max-w-md">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Page introuvable
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Cette page n’existe pas
        </h1>
        <p className="mt-3 text-muted-foreground">
          Le lien est peut-être incorrect, ou l’annonce n’est plus disponible.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        Retour aux annonces
      </Button>
    </main>
  )
}
