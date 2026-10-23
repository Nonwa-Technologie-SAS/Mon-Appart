import type { AdminMe } from "./types"

/**
 * Confort d'affichage seulement : l'API revérifie chaque permission. Masquer
 * une entrée n'est pas un contrôle de sécurité.
 */
export function can(me: AdminMe | null, permission: string): boolean {
  if (!me) return false
  return me.permissions.includes("*") || me.permissions.includes(permission)
}

export function canAny(me: AdminMe | null, permissions: string[]): boolean {
  return permissions.some((permission) => can(me, permission))
}

export interface NavItem {
  href: string
  label: string
  /** Une de ces permissions suffit pour afficher l'entrée. */
  anyOf: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tableau de bord", anyOf: ["admin:access"] },
  {
    href: "/analytics",
    label: "Business Intelligence",
    anyOf: ["analytics:admin"],
  },
  {
    href: "/ai",
    label: "Gouvernance IA",
    anyOf: ["ai:admin"],
  },
  { href: "/users", label: "Utilisateurs", anyOf: ["user:read"] },
  {
    href: "/listings",
    label: "Annonces",
    anyOf: ["listing:moderate", "listing:suspend"],
  },
  { href: "/reports", label: "Signalements", anyOf: ["report:review"] },
  {
    href: "/verifications",
    label: "Vérifications",
    anyOf: ["verification:read"],
  },
  { href: "/billing", label: "Facturation", anyOf: ["billing:read"] },
  {
    href: "/partners",
    label: "Partenaires",
    anyOf: ["partner:read", "partner:manage"],
  },
  {
    href: "/supply-leads",
    label: "Acquisition offre",
    anyOf: ["partner:read", "partner:manage"],
  },
  { href: "/audit", label: "Journal d'audit", anyOf: ["audit_log:read"] },
  { href: "/roles", label: "Rôles", anyOf: ["role:read"] },
  {
    href: "/settings/reasons",
    label: "Motifs de modération",
    anyOf: ["listing:moderate", "listing:suspend", "settings:manage"],
  },
]

export function visibleNav(me: AdminMe | null): NavItem[] {
  return NAV_ITEMS.filter((item) => canAny(me, item.anyOf))
}
