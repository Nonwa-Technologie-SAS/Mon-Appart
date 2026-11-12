import type { LucideIcon } from "lucide-react"
import {
  BadgeCheck,
  Bot,
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  Handshake,
  LayoutDashboard,
  ListOrdered,
  ScrollText,
  Settings2,
  Shield,
  Users,
  Workflow,
} from "lucide-react"

/** Icônes de navigation, indexées par `href` (pas de React dans permissions). */
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/analytics": ClipboardList,
  "/ai": Bot,
  "/users": Users,
  "/listings": Building2,
  "/reports": FileWarning,
  "/verifications": BadgeCheck,
  "/billing": CircleDollarSign,
  "/partners": Handshake,
  "/supply-leads": Workflow,
  "/audit": ScrollText,
  "/events": ListOrdered,
  "/roles": Shield,
  "/settings/reasons": Settings2,
}

export const QUEUE_ICONS: Record<string, LucideIcon> = {
  listings_pending_review: Building2,
  listings_suspended: FileWarning,
  reports_open: FileWarning,
  verifications_awaiting_review: BadgeCheck,
  risk_signals_open: Shield,
  users_blocked: Users,
  users_new_7d: Users,
}
