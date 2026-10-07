import Link from "next/link"

import { BrandMark } from "@/components/site/brand-mark"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <BrandMark />
            <p className="mt-3 text-sm text-muted-foreground">
              Trouvez, visitez et louez un logement en Côte d’Ivoire, simplement
              et en toute confiance.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-3 sm:gap-8">
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">Explorer</p>
              <Link href="/" className="text-muted-foreground hover:text-primary">
                Annonces
              </Link>
              <Link
                href="/inscription/agence"
                className="text-muted-foreground hover:text-primary"
              >
                Agences
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">Propriétaires</p>
              <Link
                href="/inscription/proprietaire"
                className="text-muted-foreground hover:text-primary"
              >
                Publier un bien
              </Link>
              <Link
                href="/connexion"
                className="text-muted-foreground hover:text-primary"
              >
                Connexion
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">Plateforme</p>
              <Link
                href="/a-propos"
                className="text-muted-foreground hover:text-primary"
              >
                À propos
              </Link>
              <p className="text-muted-foreground">Annonces vérifiées</p>
              <p className="text-muted-foreground">Visites sécurisées</p>
            </div>
          </div>
        </div>
        <p className="border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Mon Appart · Côte d’Ivoire
        </p>
      </div>
    </footer>
  )
}
