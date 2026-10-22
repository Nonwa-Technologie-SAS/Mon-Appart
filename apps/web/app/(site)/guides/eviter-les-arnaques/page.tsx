import type { Metadata } from "next"

import { GuideArticle } from "@/components/seo/guide-article"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Éviter les annonces frauduleuses",
  description:
    "Signaux d’alerte courants et bonnes pratiques avant de verser de l’argent ou de partager des documents.",
  path: "/guides/eviter-les-arnaques",
})

export default function GuideScamsPage() {
  return (
    <GuideArticle
      title="Éviter les annonces frauduleuses"
      lead="Quelques réflexes simples réduisent le risque, sans garantir une protection absolue."
    >
      <h2 className="text-xl font-semibold">Signaux d’alerte</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Loyer très inférieur au marché local sans explication crédible.</li>
        <li>Paiement exigé avant toute visite ou vérification.</li>
        <li>Refus de visite, photos floues ou incohérentes avec la description.</li>
        <li>Pression urgente (« demain c’est pris ») pour court-circuiter la réflexion.</li>
      </ul>
      <h2 className="text-xl font-semibold">Bonnes pratiques</h2>
      <p>
        Visitez le bien (ou une visite virtuelle crédible), vérifiez l’identité de
        l’interlocuteur, et conservez des traces écrites. Ne partagez pas de copies
        de documents d’identité hors d’un cadre clairement justifié.
      </p>
      <p>
        Mon Appart facilite la mise en relation ; il ne remplace pas vos vérifications
        personnelles ni un conseil juridique.
      </p>
    </GuideArticle>
  )
}
