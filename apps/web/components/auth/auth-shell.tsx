import Image from "next/image"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { BrandMark } from "@/components/site/brand-mark"
import { Button } from "@/components/ui/button"

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-svh w-full bg-background lg:grid-cols-2">
      <div className="relative h-48 overflow-hidden sm:h-64 lg:h-auto lg:min-h-svh">
        <Image
          src="/auth-hero.jpg"
          alt="Terrasse d’un logement moderne en Côte d’Ivoire"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/30 to-black/10 lg:bg-gradient-to-tr lg:from-primary/80 lg:via-primary/25 lg:to-transparent" />
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 left-3 z-10 bg-white/95 text-foreground hover:bg-white sm:top-4 sm:left-4"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Accueil
        </Button>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8 lg:inset-auto lg:right-auto lg:bottom-12 lg:left-10 lg:max-w-lg">
          <p className="text-lg font-semibold leading-snug sm:text-2xl lg:text-4xl">
            Trouvez votre chez-vous.
          </p>
          <p className="mt-2 hidden text-sm text-white/90 sm:block lg:text-base">
            Publiez et gérez vos biens en toute confiance, partout en Côte
            d’Ivoire.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-8 sm:p-8">
        <div className="flex w-full max-w-md flex-col items-center gap-6 sm:gap-8">
          <Button
            variant="ghost"
            className="-ml-2 self-start lg:hidden"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Retour à l’accueil
          </Button>
          <BrandMark />
          <div className="w-full">{children}</div>
        </div>
      </div>
    </main>
  )
}
