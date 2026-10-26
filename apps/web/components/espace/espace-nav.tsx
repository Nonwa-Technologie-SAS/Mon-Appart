import Link from "next/link"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/espace", label: "Tableau de bord" },
  { href: "/espace/demandes", label: "Demandes" },
  { href: "/espace/visites", label: "Visites" },
  { href: "/espace/publier", label: "Publier" },
  { href: "/espace/verification", label: "Vérification" },
] as const

export function EspaceNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Espace professionnel"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/espace"
            ? current === "/espace"
            : current.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-3 py-2 text-sm font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
