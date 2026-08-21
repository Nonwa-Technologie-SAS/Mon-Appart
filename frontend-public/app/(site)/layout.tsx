import { SiteFooterGate } from "@/components/site/site-footer-gate"
import { SiteHeader } from "@/components/site/site-header"
import { PageEnter } from "@/components/site/page-enter"

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh min-w-0 flex-col">
      <SiteHeader />
      <PageEnter>{children}</PageEnter>
      <SiteFooterGate />
    </div>
  )
}
