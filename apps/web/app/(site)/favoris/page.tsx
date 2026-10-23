import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAuthPage } from "@/lib/auth-session"
import { listNestFavorites } from "@/lib/nest-favorites"

export default async function FavorisPage() {
  await requireAuthPage("/favoris")
  const favorites = await listNestFavorites()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Favoris
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Biens suivis
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos favoris restent privés. Une baisse de prix ou une indisponibilité
          pourra vous être signalée selon vos préférences.
        </p>
      </div>
      {favorites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun favori</CardTitle>
            <CardDescription>
              Enregistrez un bien depuis une fiche pour le retrouver ici.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/" />}>
              Parcourir les annonces
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {favorites.map((item) => (
            <li key={item.listingId}>
              <Card className="py-4">
                <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Ajouté le{" "}
                      {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/annonces/${item.listingId}`} />}
                  >
                    Voir l’annonce
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
