import type { Metadata, Viewport } from "next"
import { Poppins } from "next/font/google"

import { JsonLd } from "@/components/seo/json-ld"
import { NetworkStatus } from "@/components/pwa/network-status"
import { PwaRegister } from "@/components/pwa/pwa-register"
import { NavigationProgress } from "@/components/site/navigation-progress"
import {
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  isIndexableEnvironment,
  organizationJsonLd,
  SITE_NAME,
  websiteJsonLd,
} from "@/lib/seo"
import { cn } from "@/lib/utils"

import "./globals.css"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} — Logements de confiance en Côte d’Ivoire`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  robots: isIndexableEnvironment()
    ? { index: true, follow: true }
    : { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_CI",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Logements de confiance en Côte d’Ivoire`,
    description: DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Logements de confiance en Côte d’Ivoire`,
    description: DEFAULT_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1565C0",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full antialiased", poppins.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <NavigationProgress />
        <NetworkStatus />
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
