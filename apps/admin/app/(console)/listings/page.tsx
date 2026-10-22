import { ListingQueue } from "@/components/listings/listing-queue"
import { firstParam } from "@/lib/search-params"

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <ListingQueue
      initial={{
        status: firstParam(params.status),
        listingType: firstParam(params.listingType),
        q: firstParam(params.q),
      }}
    />
  )
}
