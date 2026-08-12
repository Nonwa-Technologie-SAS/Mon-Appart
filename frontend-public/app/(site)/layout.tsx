import { SiteFooterGate } from "@/components/site/site-footer-gate"
import { SiteHeader } from "@/components/site/site-header"

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <SiteFooterGate />
    </div>
  )
}
