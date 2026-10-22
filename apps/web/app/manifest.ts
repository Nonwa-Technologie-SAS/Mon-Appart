import type { MetadataRoute } from "next"

import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo"

/**
 * Web App Manifest — installation PWA sur navigateurs compatibles.
 * Les URLs sont relatives ; le domaine vient de la config déployée.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f3f6f9",
    theme_color: "#1565C0",
    lang: "fr",
    dir: "ltr",
    categories: ["lifestyle", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Rechercher un logement",
        short_name: "Recherche",
        url: "/",
        description: "Ouvrir la recherche Mon Appart",
      },
      {
        name: "Locations",
        short_name: "Locations",
        url: "/locations",
      },
      {
        name: "Publier un bien",
        short_name: "Publier",
        url: "/inscription/proprietaire",
      },
    ],
  }
}
