import type { PropertyType } from "@/lib/domain-enums"

import { listingSegment, locationSlug } from "./slug"

/** URL canonique d'une fiche annonce. */
export function listingPath(title: string, id: string): string {
  return `/annonces/${listingSegment(title, id)}`
}

/** Ancienne URL conservée pour redirection 308. */
export function legacyListingPath(id: string): string {
  return `/biens/${id}`
}

export function locationPath(location: string): string {
  return `/location/${locationSlug(location)}`
}

export type DestinationKind = "operation" | "type" | "guide"

export type SeoDestination = {
  path: string
  title: string
  description: string
  /** Filtre catalogue : type de bien, ou null pour toutes les locations. */
  type: PropertyType | null
  kind: DestinationKind
  /** Nombre minimal d'annonces AVAILABLE pour inclure la page au sitemap. */
  minListings: number
}

/**
 * Pages de destination indexables (catalogue).
 * Pas de pages locales inventées ici : elles sont dérivées des localisations
 * réellement présentes en base (voir sitemap).
 */
export const CATALOG_DESTINATIONS: readonly SeoDestination[] = [
  {
    path: "/locations",
    title: "Locations immobilières en Côte d’Ivoire",
    description:
      "Parcourez les logements à louer disponibles sur Mon Appart : appartements, maisons, studios et villas.",
    type: null,
    kind: "operation",
    minListings: 1,
  },
  {
    path: "/appartements-a-louer",
    title: "Appartements à louer",
    description:
      "Annonces d’appartements à louer en Côte d’Ivoire, avec photos, prix en F CFA et demande de visite.",
    type: "APARTMENT",
    kind: "type",
    minListings: 1,
  },
  {
    path: "/maisons-a-louer",
    title: "Maisons à louer",
    description:
      "Maisons à louer disponibles sur Mon Appart. Comparez localisation, surface et loyer mensuel.",
    type: "HOUSE",
    kind: "type",
    minListings: 1,
  },
  {
    path: "/studios-a-louer",
    title: "Studios à louer",
    description:
      "Studios à louer en Côte d’Ivoire : annonces actualisées, photos et contact pour une visite.",
    type: "STUDIO",
    kind: "type",
    minListings: 1,
  },
  {
    path: "/villas-a-louer",
    title: "Villas à louer",
    description:
      "Villas à louer sur Mon Appart. Consultez les annonces publiées et demandez une visite.",
    type: "VILLA",
    kind: "type",
    minListings: 1,
  },
  {
    path: "/terrains",
    title: "Terrains",
    description:
      "Terrains proposés sur Mon Appart. Vérifiez chaque annonce avant toute démarche.",
    type: "LAND",
    kind: "type",
    minListings: 1,
  },
  {
    path: "/bureaux",
    title: "Bureaux et locaux",
    description:
      "Bureaux à louer ou locaux commerciaux publiés sur Mon Appart.",
    type: "OFFICE",
    kind: "type",
    minListings: 1,
  },
]

export function destinationByPath(path: string): SeoDestination | undefined {
  return CATALOG_DESTINATIONS.find((item) => item.path === path)
}

/** Guides éditoriaux (contenu fixe, sans inventer de règles juridiques). */
export const GUIDE_PATHS = [
  {
    path: "/guides/louer-un-logement",
    title: "Louer un logement en Côte d’Ivoire",
    description:
      "Repères pratiques pour chercher un logement, préparer une visite et rester vigilant face aux arnaques. Informations générales, à compléter selon votre situation.",
  },
  {
    path: "/guides/publier-une-annonce",
    title: "Publier une annonce immobilière",
    description:
      "Conseils pour rédiger une annonce claire : photos, localisation, prix et informations utiles aux locataires.",
  },
  {
    path: "/guides/eviter-les-arnaques",
    title: "Éviter les annonces frauduleuses",
    description:
      "Signaux d’alerte courants et bonnes pratiques avant de verser de l’argent ou de partager des documents.",
  },
] as const
