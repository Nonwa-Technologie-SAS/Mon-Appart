import { ReportDetail } from "@/components/reports/report-detail"

export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>
}) {
  const { reportId } = await params
  return <ReportDetail reportId={reportId} />
}
