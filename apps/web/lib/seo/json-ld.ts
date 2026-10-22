import { formatPropertyType } from "@/lib/format"
import type { PropertyType } from "@/lib/domain-enums"

import { absoluteUrl, SITE_NAME } from "./site"
import { listingPath } from "./paths"

/** Sérialisation sûre pour insertion dans <script type="application/ld+json">. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description:
      "Plateforme de recherche et de location de logements en Côte d’Ivoire.",
    areaServed: {
      "@type": "Country",
      name: "Côte d’Ivoire",
    },
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "fr-CI",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function breadcrumbJsonLd(
  items: readonly { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

/**
 * Annonce immobilière. RealEstateListing + Offer uniquement si le bien est
 * AVAILABLE et que prix / devise sont connus (XOF / F CFA).
 */
export function listingJsonLd(property: {
  id: string
  title: string
  description: string
  type: PropertyType
  location: string
  price: number
  imageUrl: string | null
  updatedAt?: Date | string | null
  available: boolean
}) {
  const url = absoluteUrl(listingPath(property.title, property.id))
  const images = property.imageUrl
    ? [absoluteUrl(property.imageUrl)]
    : undefined

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: property.description.slice(0, 5000),
    url,
    ...(images ? { image: images } : {}),
    ...(property.updatedAt
      ? {
          dateModified: new Date(property.updatedAt).toISOString(),
        }
      : {}),
    about: {
      "@type": "Accommodation",
      name: property.title,
      accommodationCategory: formatPropertyType(property.type),
      address: {
        "@type": "PostalAddress",
        addressLocality: property.location,
        addressCountry: "CI",
      },
    },
    ...(property.available
      ? {
          offers: {
            "@type": "Offer",
            price: property.price,
            priceCurrency: "XOF",
            availability: "https://schema.org/InStock",
            url,
          },
        }
      : {}),
  }
}
