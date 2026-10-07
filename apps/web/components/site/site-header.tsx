import Link from "next/link"
import { HeartIcon, UserRoundIcon } from "lucide-react"

import { BrandMark } from "@/components/site/brand-mark"
import { SiteMobileNav } from "@/components/site/site-mobile-nav"
import { getSession, isPublisherRole } from "@/lib/auth-session"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PUBLIC_NAV_ITEMS: { href: string; label: string; active?: boolean }[] = [
  { href: "/", label: "Louer", active: true },
  { href: "/", label: "Acheter" },
  { href: "/inscription/agence", label: "Agences" },
]

const PUBLISHER_NAV_ITEMS: { href: string; label: string; active?: boolean }[] =
  [
    { href: "/", label: "Annonces" },
    { href: "/espace", label: "Mon espace", active: true },
    { href: "/espace/publier", label: "Publier" },
  ]

export async function SiteHeader() {
  const session = await getSession()
  const publisher = isPublisherRole(session?.user.role)
  const navItems = publisher ? PUBLISHER_NAV_ITEMS : PUBLIC_NAV_ITEMS
  const accountHref = publisher ? "/espace" : "/connexion"

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <SiteMobileNav
            items={navItems}
            publisher={publisher}
            signedIn={Boolean(session)}
            accountHref={accountHref}
          />
          <BrandMark compact />
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                item.active
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          {publisher ? (
            <Button
              variant="outline"
              className="hidden lg:inline-flex"
              nativeButton={false}
              render={<Link href="/espace" />}
            >
              Mon espace
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="hidden lg:inline-flex"
              nativeButton={false}
              render={<Link href="/inscription/proprietaire" />}
            >
              Publier un bien
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden text-secondary sm:inline-flex"
            aria-label="Favoris"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <HeartIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={publisher ? "Mon espace" : "Connexion"}
            nativeButton={false}
            render={<Link href={accountHref} />}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-primary sm:size-9">
              <UserRoundIcon />
            </span>
            {session ? (
              <span className="absolute right-1 bottom-1 size-2.5 rounded-full border-2 border-white bg-success" />
            ) : null}
          </Button>
        </div>
      </div>
    </header>
  )
}
