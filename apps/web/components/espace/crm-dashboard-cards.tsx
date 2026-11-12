import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  Clock3Icon,
  InboxIcon,
  MessageSquareReplyIcon,
  PercentIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPercent } from "@/lib/crm-labels"
import type { InquiryDashboard } from "@/lib/nest-inquiries"
import { cn } from "@/lib/utils"

type KpiCard = {
  key: string
  href?: string
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  attention?: boolean
}

export function CrmDashboardCards({ data }: { data: InquiryDashboard }) {
  const cards: KpiCard[] = [
    {
      key: "unhandled",
      href: "/espace/demandes?status=OPEN",
      label: "Non traitées",
      value: String(data.unhandled),
      hint: "Demandes en attente de votre réponse",
      icon: InboxIcon,
      attention: data.unhandled > 0,
    },
    {
      key: "newContacts",
      href: "/espace/demandes",
      label: "Nouveaux contacts (7 j)",
      value: String(data.newContacts),
      hint: "Contacts reçus sur la dernière semaine",
      icon: MessageSquareReplyIcon,
    },
    {
      key: "pendingVisits",
      href: "/espace/visites",
      label: "Visites à confirmer",
      value: String(data.pendingVisits),
      hint: "Demandes de visite à valider",
      icon: CalendarClockIcon,
      attention: data.pendingVisits > 0,
    },
    {
      key: "upcomingVisits",
      href: "/espace/visites",
      label: "Visites à venir",
      value: String(data.confirmedUpcomingVisits),
      hint: "Visites confirmées à planifier",
      icon: CalendarDaysIcon,
    },
    {
      key: "responseRate",
      href: "/espace/demandes",
      label: "Taux de réponse",
      value: formatPercent(data.responseRate),
      hint: "Part des demandes déjà traitées",
      icon: PercentIcon,
    },
    {
      key: "contactToVisit",
      href: "/espace/demandes",
      label: "Contacts → visite",
      value: formatPercent(data.contactToVisitRate),
      hint: "Conversion des contacts en visites",
      icon: TrendingUpIcon,
    },
  ]

  if (data.medianFirstResponseHours !== null) {
    cards.push({
      key: "medianResponse",
      label: "Délai médian de 1ʳᵉ réponse",
      value: `${data.medianFirstResponseHours} h`,
      hint: "Temps médian avant votre première réponse",
      icon: Clock3Icon,
    })
  }

  if (data.overdueActions > 0) {
    cards.push({
      key: "overdue",
      href: "/espace/demandes",
      label: "Actions échues",
      value: String(data.overdueActions),
      hint: "À traiter en priorité",
      icon: TriangleAlertIcon,
      attention: true,
    })
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <KpiTile key={card.key} card={card} />
      ))}
    </section>
  )
}

function KpiTile({ card }: { card: KpiCard }) {
  const Icon = card.icon
  const content = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden transition-[border-color,box-shadow] duration-[var(--motion-fast)]",
        card.href && "hover:border-primary/40 hover:shadow-md",
        card.attention && "border-warning/40 bg-warning/5",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-colors",
          card.attention
            ? "bg-warning"
            : "bg-primary/70 group-hover:bg-primary",
        )}
      />
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2 pl-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {card.label}
        </CardTitle>
        <span
          className={cn(
            "rounded-lg p-2",
            card.attention
              ? "bg-warning/15 text-warning"
              : "bg-accent text-accent-foreground",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="pl-5">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {card.value}
        </p>
        {card.hint ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {card.hint}
          </p>
        ) : null}
        {card.href ? (
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Ouvrir
            <ArrowRightIcon
              aria-hidden
              className="size-3.5 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5"
            />
          </p>
        ) : null}
      </CardContent>
    </Card>
  )

  if (!card.href) return content

  return (
    <Link href={card.href} className="min-w-0">
      {content}
    </Link>
  )
}

export function CrmTopListings({
  items,
}: {
  items: InquiryDashboard["topListings"]
}) {
  if (!items?.length) return null
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <span className="rounded-lg bg-accent p-2 text-accent-foreground">
          <BadgeCheckIcon aria-hidden className="size-4" />
        </span>
        <CardTitle>Annonces qui génèrent des contacts</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
            >
              <Link
                href={`/espace/demandes?listingId=${item.id}`}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {item.title}
              </Link>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {item.contacts}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
