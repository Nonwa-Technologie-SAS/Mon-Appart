import Link from "next/link"
import {
  BellIcon,
  HeartIcon,
  MenuIcon,
  UserRoundIcon,
} from "lucide-react"

import { getSession } from "@/lib/auth-session"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Acheter" },
  { href: "/", label: "Louer", active: true },
  { href: "/inscription/proprietaire", label: "Vendre" },
  { href: "/inscription/agence", label: "Trouver un agent" },
] as const

export async function SiteHeader() {
  const session = await getSession()

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-white">
      <div className="mx-auto flex h-[4.25rem] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-foreground"
            aria-label="Menu"
          >
            <MenuIcon />
          </Button>
          <Link
            href="/"
            className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          >
            Mon Appart
          </Link>
        </div>

        <nav className="hidden rounded-full border border-border bg-white p-1 shadow-sm md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-foreground"
            aria-label="Favoris"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <HeartIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-foreground"
            aria-label="Notifications"
          >
            <BellIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full text-foreground"
            aria-label={session ? "Mon compte" : "Connexion"}
            nativeButton={false}
            render={<Link href="/connexion" />}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-muted">
              <UserRoundIcon className="size-4" />
            </span>
            <span className="absolute right-1 bottom-1 size-2.5 rounded-full border-2 border-white bg-primary" />
          </Button>
        </div>
      </div>
      <div className="border-t border-border/70 px-4 py-2 md:hidden">
        <nav className="flex gap-2 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                item.active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
