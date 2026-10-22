import type { Metadata } from "next"

import { PageEnter } from "@/components/site/page-enter"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageEnter>{children}</PageEnter>
}
