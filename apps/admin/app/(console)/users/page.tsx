import { UserList } from "@/components/users/user-list"
import { firstParam } from "@/lib/search-params"

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <UserList
      initial={{
        q: firstParam(params.q),
        status: firstParam(params.status),
        role: firstParam(params.role),
      }}
    />
  )
}
