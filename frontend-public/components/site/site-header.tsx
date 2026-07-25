import Link from "next/link"

import { getSession } from "@/lib/auth-session"
import { Button } from "@/components/ui/button"

export async function SiteHeader() {
  const session = await getSession()

  return (
    <header className="sticky top-0 z-30 border-b border-primary/20 bg-primary text-primary-foreground">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold tracking-tight"
        >
          Appatam
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/recherche" />}
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            Rechercher
          </Button>
          {session ? (
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/connexion" />}
              className="hidden sm:inline-flex"
            >
              Mon compte
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/connexion" />}
                className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              >
                Connexion
              </Button>
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/inscription/proprietaire" />}
              >
                Publier un bien
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
