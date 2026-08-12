import type { Metadata } from "next"
import { DM_Sans, Syne } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
})

export const metadata: Metadata = {
  title: {
    default: "Mon Appart — Trouvez votre prochain chez-vous",
    template: "%s · Mon Appart",
  },
  description:
    "Recherchez des maisons, appartements et villas disponibles. Réservez une visite en quelques clics.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full antialiased", dmSans.variable, syne.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}

