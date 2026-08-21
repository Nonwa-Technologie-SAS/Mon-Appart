import type { Metadata, Viewport } from "next"
import { Poppins } from "next/font/google"

import { NavigationProgress } from "@/components/site/navigation-progress"
import { cn } from "@/lib/utils"

import "./globals.css"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: {
    default: "Mon Appart — Logements de confiance en Côte d’Ivoire",
    template: "%s · Mon Appart",
  },
  description:
    "Recherchez, découvrez et louez un logement facilement en Côte d’Ivoire. Annonces vérifiées, visites simples, en toute confiance.",
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
        <NavigationProgress />
        {children}
      </body>
    </html>
  )
}
