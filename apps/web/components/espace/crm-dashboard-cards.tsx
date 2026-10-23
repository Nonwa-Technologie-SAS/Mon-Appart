import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPercent } from "@/lib/crm-labels"
import type { InquiryDashboard } from "@/lib/nest-inquiries"

export function CrmDashboardCards({ data }: { data: InquiryDashboard }) {
  const cards = [
    {
      href: "/espace/demandes?status=OPEN",
      label: "Non traitées",
      value: String(data.unhandled),
    },
    {
      href: "/espace/demandes",
      label: "Nouveaux contacts (7 j)",
      value: String(data.newContacts),
    },
    {
      href: "/espace/visites",
      label: "Visites à confirmer",
      value: String(data.pendingVisits),
    },
    {
      href: "/espace/visites",
      label: "Visites à venir",
      value: String(data.confirmedUpcomingVisits),
    },
    {
      href: "/espace/demandes",
      label: "Taux de réponse",
      value: formatPercent(data.responseRate),
    },
    {
      href: "/espace/demandes",
      label: "Contacts → visite",
      value: formatPercent(data.contactToVisitRate),
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.label} href={card.href} className="min-w-0">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {card.value}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
      {data.medianFirstResponseHours !== null ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Délai médian de 1ʳᵉ réponse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.medianFirstResponseHours} h
            </p>
          </CardContent>
        </Card>
      ) : null}
      {data.overdueActions > 0 ? (
        <Link href="/espace/demandes" className="min-w-0">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actions échues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {data.overdueActions}
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </section>
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
      <CardHeader>
        <CardTitle>Annonces qui génèrent des contacts</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <Link
                href={`/espace/demandes?listingId=${item.id}`}
                className="min-w-0 truncate hover:underline"
              >
                {item.title}
              </Link>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.contacts}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
