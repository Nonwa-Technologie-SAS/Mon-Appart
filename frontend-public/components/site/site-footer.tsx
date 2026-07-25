import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-heading text-lg font-semibold text-primary">Appatam</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Trouvez votre prochain chez-vous, simplement.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/recherche" className="text-foreground underline-offset-4 hover:underline">
            Annonces
          </Link>
          <Link
            href="/inscription/proprietaire"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Propriétaires
          </Link>
          <Link
            href="/inscription/agence"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Agences
          </Link>
          <Link href="/connexion" className="text-foreground underline-offset-4 hover:underline">
            Connexion
          </Link>
        </div>
      </div>
    </footer>
  )
}
