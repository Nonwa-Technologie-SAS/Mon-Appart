import type { Metadata } from "next"

import { formatPrice, formatPropertyType } from "@/lib/format"
import type { PropertyType } from "@/lib/domain-enums"

import {
  DEFAULT_DESCRIPTION,
  absoluteUrl,
  getSiteUrl,
  isIndexableEnvironment,
  SITE_NAME,
} from "./site"

type BuildPageMetaInput = {
  title: string
  description: string
  path: string
  index?: boolean
  image?: string | null
  type?: "website" | "article"
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
}

export function buildPageMetadata({
  title,
  description,
  path,
  index = true,
  image,
  type = "website",
}: BuildPageMetaInput): Metadata {
  const canIndex = index && isIndexableEnvironment()
  const url = absoluteUrl(path)
  const desc = truncate(description || DEFAULT_DESCRIPTION, 160)
  const ogImage = image ? absoluteUrl(image) : undefined

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description: desc,
    alternates: { canonical: url },
    robots: canIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type,
      locale: "fr_CI",
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description: desc,
      url,
      ...(ogImage
        ? { images: [{ url: ogImage, alt: title }] }
        : undefined),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: `${title} · ${SITE_NAME}`,
      description: desc,
      ...(ogImage ? { images: [ogImage] } : undefined),
    },
  }
}

export function listingSeoCopy(property: {
  title: string
  description: string
  type: PropertyType
  location: string
  price: number
}): { title: string; description: string } {
  const kind = formatPropertyType(property.type)
  const price = formatPrice(property.price)
  const title = truncate(
    `${property.title} — ${kind} à louer à ${property.location}`,
    60,
  )
  const excerpt = truncate(property.description, 110)
  const description = truncate(
    `${kind} à ${property.location}. ${price} / mois. ${excerpt}`,
    160,
  )
  return { title, description }
}
