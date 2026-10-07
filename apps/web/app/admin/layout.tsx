import { PageEnter } from "@/components/site/page-enter"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageEnter>{children}</PageEnter>
}
