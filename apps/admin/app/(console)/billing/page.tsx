import { BillingView } from "@/components/billing/billing-view"
import { billingTab } from "@/lib/billing"
import { firstParam } from "@/lib/search-params"

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return <BillingView initialTab={billingTab(firstParam(params.tab))} />
}
