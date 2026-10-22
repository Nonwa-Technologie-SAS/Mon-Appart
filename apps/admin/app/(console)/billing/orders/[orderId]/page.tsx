import { OrderDetail } from "@/components/billing/order-detail"

export default async function BillingOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return <OrderDetail orderId={orderId} />
}
