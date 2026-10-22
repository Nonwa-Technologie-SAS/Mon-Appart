import type { MetadataRoute } from "next"

import { isIndexableEnvironment, getSiteUrl } from "@/lib/seo/site"

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl()

  if (!isIndexableEnvironment()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/espace",
        "/espace/",
        "/profil",
        "/profil/",
        "/connexion",
        "/inscription",
        "/inscription/",
        "/api/",
      ],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
