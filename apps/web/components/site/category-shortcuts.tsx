import Link from "next/link"

import { cn } from "@/lib/utils"

const CATEGORIES = [
  { href: "/appartements-a-louer", label: "Appartements" },
  { href: "/maisons-a-louer", label: "Maisons" },
  { href: "/studios-a-louer", label: "Studios" },
  { href: "/villas-a-louer", label: "Villas" },
  { href: "/terrains", label: "Terrains" },
  { href: "/locations", label: "Toutes les locations" },
] as const

/** Raccourcis catalogues SEO — liens réels uniquement. */
export function CategoryShortcuts({
  className,
}: {
  className?: string
}) {
  return (
    <nav
      aria-label="Catégories de biens"
      className={cn("flex flex-col gap-2", className)}
    >
      <p className="text-sm font-medium text-foreground">Parcourir par type</p>
      <ul className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <li key={category.href}>
            <Link
              href={category.href}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-[var(--elevation-sm)] transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {category.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
