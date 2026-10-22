import { HeroSearch } from "@/components/site/hero-search"

/** Bloc hero autonome (pages marketing / variantes). L’accueil utilise SearchResultsLayout. */
export function HomeHero() {
  return (
    <section className="border-b border-border surface-hero">
      <div className="container-content flex flex-col gap-6 py-8 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase sm:text-base">
            Mon Appart
          </p>
          <h1 className="mt-2 text-[1.75rem] leading-tight font-bold sm:text-4xl lg:text-5xl">
            Trouvez votre chez-vous
          </h1>
          <p className="mt-3 max-w-lg text-base text-muted-foreground">
            Parcourez des annonces de location en Côte d’Ivoire et demandez une
            visite en quelques clics.
          </p>
        </div>
        <HeroSearch />
      </div>
    </section>
  )
}
