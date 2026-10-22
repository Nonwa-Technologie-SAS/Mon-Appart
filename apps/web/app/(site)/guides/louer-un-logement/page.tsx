import type { Metadata } from "next"

import { GuideArticle } from "@/components/seo/guide-article"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Louer un logement en Côte d’Ivoire",
  description:
    "Repères pratiques pour chercher un logement, préparer une visite et rester vigilant. Informations générales, à adapter à votre situation.",
  path: "/guides/louer-un-logement",
})

export default function GuideRentPage() {
  return (
    <GuideArticle
      title="Louer un logement en Côte d’Ivoire"
      lead="Une démarche claire pour comparer des annonces et préparer une visite, sans remplacer un conseil professionnel."
    >
      <h2 className="text-xl font-semibold">Clarifier votre besoin</h2>
      <p>
        Définissez un budget mensuel réaliste, le type de bien (studio, appartement,
        maison), le nombre de pièces et la zone géographique. Sur Mon Appart, utilisez
        les pages de catégories et les localisations qui correspondent à des annonces
        réellement publiées.
      </p>
      <h2 className="text-xl font-semibold">Préparer une visite</h2>
      <p>
        Notez les questions sur l’état du logement, les charges, l’accès à l’eau et à
        l’électricité, et les modalités de remise des clés. Demandez une visite via
        l’annonce lorsque le bien est encore disponible.
      </p>
      <h2 className="text-xl font-semibold">Rester prudent</h2>
      <p>
        Méfiez-vous des pressions pour payer avant une visite, des prix anormalement
        bas, ou des demandes de documents via des canaux non vérifiés. Consultez aussi
        notre guide sur les arnaques.
      </p>
    </GuideArticle>
  )
}
