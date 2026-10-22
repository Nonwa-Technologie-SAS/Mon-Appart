import { AnalyticsProvider } from "@/components/site/analytics-provider"
import { PageEnter } from "@/components/site/page-enter"
import { SiteFooterGate } from "@/components/site/site-footer-gate"
import { SiteHeader } from "@/components/site/site-header"
import { SkipLink } from "@/components/site/skip-link"

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AnalyticsProvider>
      <div className="flex min-h-svh min-w-0 flex-col">
        <SkipLink />
        <SiteHeader />
        <div
          id="contenu-principal"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          <PageEnter>{children}</PageEnter>
        </div>
        <SiteFooterGate />
      </div>
    </AnalyticsProvider>
  )
}
