import { ReportsView } from "@/components/reports/report-queue"
import { firstParam } from "@/lib/search-params"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <ReportsView
      initialTab={firstParam(params.tab) === "signals" ? "signals" : "reports"}
      initialStatus={firstParam(params.status)}
    />
  )
}
