import {
  BadgeCheckIcon,
  CalendarDaysIcon,
  InboxIcon,
  LayoutDashboardIcon,
  PlusCircleIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

const LINKS: ReadonlyArray<{
  href: string
  label: string
  icon: LucideIcon
}> = [
  { href: "/espace", label: "Tableau de bord", icon: LayoutDashboardIcon },
  { href: "/espace/demandes", label: "Demandes", icon: InboxIcon },
  { href: "/espace/visites", label: "Visites", icon: CalendarDaysIcon },
  { href: "/espace/publier", label: "Publier", icon: PlusCircleIcon },
  {
    href: "/espace/verification",
    label: "Vérification",
    icon: BadgeCheckIcon,
  },
]

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
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
