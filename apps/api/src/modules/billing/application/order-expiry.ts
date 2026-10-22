import type { Tx } from "../../../database/database.service"
import { BillingAuditAction, BillingEntity } from "../domain/billing-events"
import type { BillingActivity } from "./billing-activity"

/**
 * Expire une commande en attente échue (commande verrouillée par l'appelant).
 * Ses tentatives ouvertes restent ouvertes : un paiement confirmé plus tard
 * par le prestataire est toujours appliqué (paiement tardif).
 */
export async function expireOrderInTx(
  tx: Tx,
  activity: BillingActivity,
  orderId: bigint,
  now: Date,
): Promise<boolean> {
  const result = await tx.billingOrder.updateMany({
    where: { id: orderId, status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  })
  if (result.count === 0) return false
  const order = await tx.billingOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { publicId: true },
  })
  await activity.audit(
    {
      action: BillingAuditAction.ORDER_EXPIRED,
      actorId: null,
      entityType: BillingEntity.ORDER,
      entityId: order.publicId,
      oldValues: { status: "PENDING" },
      newValues: { status: "EXPIRED" },
    },
    null,
    tx,
  )
  return true
}
