import { HeroSearch } from "@/components/site/hero-search"

export function HomeHero() {
  return (
    <section className="border-b border-border bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Mon Appart</p>
          <h1 className="mt-2 text-[1.75rem] leading-tight font-bold sm:text-4xl lg:text-5xl">
            Trouvez la maison qui vous ressemble
          </h1>
          <p className="mt-3 max-w-lg text-base text-muted-foreground">
            Parcourez des annonces vérifiées en Côte d’Ivoire et réservez une
            visite en quelques clics.
          </p>
        </div>
        <HeroSearch />
      </div>
    </section>
  )
}
