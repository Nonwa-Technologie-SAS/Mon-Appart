import type { Metadata } from "next"

import { GuideArticle } from "@/components/seo/guide-article"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Publier une annonce immobilière",
  description:
    "Conseils pour rédiger une annonce claire : photos, localisation, prix en F CFA et informations utiles aux locataires.",
  path: "/guides/publier-une-annonce",
})

export default function GuidePublishPage() {
  return (
    <GuideArticle
      title="Publier une annonce immobilière"
      lead="Une annonce complète attire des demandes plus pertinentes et limite les allers-retours."
    >
      <h2 className="text-xl font-semibold">Titre et description</h2>
      <p>
        Indiquez le type de bien, le quartier et le point fort principal. Décrivez
        l’état, les pièces et les conditions de location sans inventer de
        caractéristiques.
      </p>
      <h2 className="text-xl font-semibold">Photos</h2>
      <p>
        Ajoutez des photos nettes des pièces principales et de l’extérieur. Une
        couverture claire améliore aussi le partage social de l’annonce.
      </p>
      <h2 className="text-xl font-semibold">Prix et localisation</h2>
      <p>
        Affichez le loyer en F CFA et une localisation compréhensible. Une
        localisation précise aide les pages locales du site lorsque plusieurs
        annonces partagent le même libellé.
      </p>
    </GuideArticle>
  )
}
