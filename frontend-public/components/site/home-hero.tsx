import Image from "next/image"

import { HeroSearch } from "@/components/site/hero-search"

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=80"

export function HomeHero() {
  return (
    <section className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden">
      <Image
        src={HERO_IMAGE}
        alt="Maison contemporaine baignée de lumière"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="animate-hero-fade font-heading text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
            Appatam
          </p>
          <h1 className="animate-hero-fade-delay mt-4 max-w-xl text-2xl font-medium text-white/95 sm:text-3xl">
            Trouvez la maison qui vous ressemble
          </h1>
          <p className="animate-hero-fade-delay-2 mt-3 max-w-lg text-base text-white/80 sm:text-lg">
            Parcourez des annonces vérifiées et réservez une visite en quelques clics.
          </p>
        </div>

        <div className="mt-10">
          <HeroSearch />
        </div>
      </div>
    </section>
  )
}
