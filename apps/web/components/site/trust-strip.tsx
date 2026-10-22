import Link from "next/link"
import { MessageCircleIcon, SearchIcon, ShieldCheckIcon } from "lucide-react"

/**
 * Arguments produits honnêtes — pas de badge « vérifié » sans backend Trust.
 */
export function TrustStrip() {
  const items = [
    {
      icon: SearchIcon,
      title: "Recherche claire",
      body: "Filtrez par quartier, type de bien et budget en F CFA.",
    },
    {
      icon: MessageCircleIcon,
      title: "Contact direct",
      body: "Demandez une visite depuis la fiche, sans parcours opaque.",
    },
    {
      icon: ShieldCheckIcon,
      title: "Prudence avant paiement",
      body: (
        <>
          Consultez notre{" "}
          <Link
            href="/guides/eviter-les-arnaques"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            guide anti-arnaques
          </Link>{" "}
          avant tout virement ou envoi de documents.
        </>
      ),
    },
  ] as const

  return (
    <section
      aria-labelledby="trust-strip-title"
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--elevation-sm)] sm:p-6"
    >
      <h2
        id="trust-strip-title"
        className="text-base font-semibold text-foreground sm:text-lg"
      >
        Pourquoi chercher sur Mon Appart
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <item.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
