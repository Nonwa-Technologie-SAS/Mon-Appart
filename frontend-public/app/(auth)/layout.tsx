import { PageEnter } from "@/components/site/page-enter"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageEnter>{children}</PageEnter>
}
