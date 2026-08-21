"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MenuIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SiteNavItem = {
  href: string
  label: string
  active?: boolean
}

export function SiteMobileNav({
  items,
  publisher,
  signedIn,
  accountHref,
}: {
  items: SiteNavItem[]
  publisher: boolean
  signedIn: boolean
  accountHref: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id="site-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-white pt-[env(safe-area-inset-top)] shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Menu</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
              >
                <XIcon />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
              {items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-3 text-base font-medium",
                    item.active
                      ? "bg-accent text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/a-propos"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
              >
                À propos
              </Link>
            </div>

            <div className="flex flex-col gap-2 border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {publisher ? (
                <Button
                  nativeButton={false}
                  render={<Link href="/espace" onClick={() => setOpen(false)} />}
                >
                  Mon espace
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={
                    <Link
                      href="/inscription/proprietaire"
                      onClick={() => setOpen(false)}
                    />
                  }
                >
                  Publier un bien
                </Button>
              )}
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={accountHref} onClick={() => setOpen(false)} />}
              >
                {signedIn ? "Mon compte" : "Connexion"}
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  )
}
