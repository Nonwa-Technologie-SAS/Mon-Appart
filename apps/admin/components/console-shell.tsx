"use client"

import { LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { formatRoles } from "@/lib/format"
import { NAV_ICONS } from "@/lib/nav-icons"
import { visibleNav } from "@/lib/permissions"

import { BrandMark } from "./brand-mark"
import { useSession } from "./session-provider"
import { Button, Loading } from "./ui"

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

/**
 * Cadre des pages du back-office. Il n'affiche rien tant que la session et
 * `admin:access` ne sont pas confirmés par l'API.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    state: { status, me },
    actions: { signOut },
  } = useSession()

  useEffect(() => {
    if (status === "anonymous" || status === "forbidden") {
      router.replace("/login")
    }
  }, [status, router])

  if (status === "unavailable") {
    return (
      <main className="mx-auto max-w-lg p-10">
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-red-50 px-4 py-3 text-sm text-destructive"
        >
          Le service est momentanément injoignable. Rechargez la page dans un
          instant.
        </p>
      </main>
    )
  }
  if (status !== "authenticated" || !me) {
    return <Loading label="Vérification de la session…" />
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="relative z-10 border-b border-border bg-card shadow-sm md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="border-b border-border px-5 py-5">
          <BrandMark href="/" size="sidebar" />
          <p className="mt-3 truncate text-sm font-medium text-foreground">
            {me.name ?? "Compte sans nom"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatRoles(me.roles)}
          </p>
        </div>

        <nav
          aria-label="Navigation principale"
          className="flex-1 px-3 py-3 md:overflow-y-auto"
        >
          <ul className="flex flex-wrap gap-1 md:flex-col md:gap-0.5">
            {visibleNav(me).map((item) => {
              const active = isActive(pathname, item.href)
              const Icon = NAV_ICONS[item.href]
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                      active
                        ? "bg-accent font-semibold text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    {Icon ? (
                      <Icon
                        aria-hidden
                        className="size-4 shrink-0"
                        strokeWidth={active ? 2.25 : 1.75}
                      />
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-4 py-4">
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden className="size-4" />
            Se déconnecter
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
