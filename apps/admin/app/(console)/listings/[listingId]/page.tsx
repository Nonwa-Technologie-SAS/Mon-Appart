import { ListingDetail } from "@/components/listings/listing-detail"

export default async function ListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params
  return <ListingDetail listingId={listingId} />
}
