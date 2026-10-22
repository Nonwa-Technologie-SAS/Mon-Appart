import { AuditLogView } from "@/components/audit-log-view"
import { firstParam } from "@/lib/search-params"

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <AuditLogView
      initial={{
        entityType: firstParam(params.entityType),
        entityId: firstParam(params.entityId),
        action: firstParam(params.action),
        actorId: firstParam(params.actorId),
      }}
    />
  )
}
