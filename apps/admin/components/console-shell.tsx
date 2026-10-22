"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { visibleNav } from "@/lib/permissions"

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
        <p role="alert" className="text-sm text-red-800">
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
      <aside className="border-b border-stone-200 bg-stone-900 text-stone-100 md:w-60 md:shrink-0 md:border-b-0">
        <div className="px-4 py-4">
          <p className="text-sm font-semibold">Mon Appart Admin</p>
          <p className="mt-1 truncate text-xs text-stone-400">
            {me.name ?? "Compte sans nom"} · {me.roles.join(", ")}
          </p>
        </div>
        <nav aria-label="Navigation principale">
          <ul className="flex flex-wrap gap-1 px-2 pb-3 md:flex-col">
            {visibleNav(me).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={
                    isActive(pathname, item.href) ? "page" : undefined
                  }
                  className="block rounded-md px-3 py-1.5 text-sm hover:bg-stone-700 aria-[current=page]:bg-stone-700 aria-[current=page]:font-medium"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-4 pb-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void signOut()}
          >
            Se déconnecter
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  )
}
