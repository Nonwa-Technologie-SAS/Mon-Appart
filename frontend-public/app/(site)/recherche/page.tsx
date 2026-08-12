import { redirect } from "next/navigation"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; maxPrice?: string }>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.type) query.set("type", params.type)
  if (params.maxPrice) query.set("maxPrice", params.maxPrice)

  const qs = query.toString()
  redirect(qs ? `/?${qs}` : "/")
}
