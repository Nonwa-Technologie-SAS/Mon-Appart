import type { Metadata, Viewport } from "next"

import { adminSite } from "@/lib/site"

import "../styles/globals.css"

export const metadata: Metadata = {
  title: adminSite.name,
  description: adminSite.description,
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1917",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
