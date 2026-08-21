import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  Building2Icon,
  CalendarCheckIcon,
  HomeIcon,
  MapPinIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Mon Appart est la plateforme de location immobilière en Côte d’Ivoire. Trouvez un logement de confiance, demandez une visite et publiez vos biens simplement.",
}

const PILLARS = [
  {
    title: "Trouver un logement",
    description:
      "Parcourez des annonces claires, avec photos, localisation et critères utiles pour comparer sans perdre de temps.",
    icon: SearchIcon,
  },
  {
    title: "Visiter simplement",
    description:
      "Demandez une visite en quelques clics, ou explorez un bien en 360° avant de vous déplacer.",
    icon: CalendarCheckIcon,
  },
  {
    title: "Louer en confiance",
    description:
      "Propriétaires, agences et visiteurs se retrouvent autour d’annonces lisibles et d’échanges plus transparents.",
    icon: ShieldCheckIcon,
  },
] as const

const AUDIENCES = [
  {
    title: "Locataires",
    description:
      "Cherchez près de chez vous, filtrez selon votre budget, puis contactez le propriétaire ou l’agence pour une visite.",
    icon: HomeIcon,
    href: "/",
    action: "Voir les annonces",
  },
  {
    title: "Propriétaires et agences",
    description:
      "Publiez un appartement, une maison ou une villa, suivez les demandes de visite et gérez vos biens depuis votre espace.",
    icon: Building2Icon,
    href: "/inscription/proprietaire",
    action: "Publier un bien",
  },
] as const

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14 lg:py-20">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              À propos de la plateforme
            </p>
            <h1 className="mt-3 text-[1.75rem] leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Trouvez votre chez-vous.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Mon Appart aide à chercher, visiter et louer un logement en Côte
              d’Ivoire — sans parcours compliqué, ni informations floues.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button nativeButton={false} render={<Link href="/" />}>
                Explorer les annonces
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/inscription/proprietaire" />}
              >
                Publier un bien
              </Button>
            </div>
          </div>

          <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-muted lg:aspect-square">
            <Image
              src="/auth-hero.jpg"
              alt="Logement moderne en Côte d’Ivoire"
              fill
              preload
              loading="eager"
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Notre mission
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Rendre la location plus simple et plus sûre. Trop de recherches se
            font encore par messages éparpillés, photos incomplètes ou visites
            mal préparées. Mon Appart rassemble l’essentiel au même endroit :
            l’annonce, les photos, la visite et le contact.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon

            return (
              <article
                key={pillar.title}
                className="rounded-xl border border-border bg-card p-5 sm:p-6"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="border-y border-border bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-10 lg:py-20">
          {AUDIENCES.map((audience) => {
            const Icon = audience.icon

            return (
              <article
                key={audience.title}
                className="flex flex-col rounded-xl border border-border bg-background p-6 sm:p-8"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 text-xl font-bold sm:text-2xl">
                  {audience.title}
                </h2>
                <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">
                  {audience.description}
                </p>
                <Button
                  className="mt-6 self-start"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={audience.href} />}
                >
                  {audience.action}
                </Button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="flex flex-col gap-6 rounded-xl bg-primary px-6 py-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-10">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/80">
              <MapPinIcon className="size-4" />
              Côte d’Ivoire
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Une plateforme pensée pour ici
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-primary-foreground/85 sm:text-base">
              Quartiers, visites, WhatsApp, photos réelles : Mon Appart est
              conçu pour la façon dont on cherche un logement aujourd’hui.
            </p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Commencer la recherche
          </Button>
        </div>
      </section>
    </main>
  )
}
