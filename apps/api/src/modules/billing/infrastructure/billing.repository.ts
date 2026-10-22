import { Injectable } from "@nestjs/common"

import {
  DatabaseService,
  type Db,
  type Tx,
} from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import type { BillingIncidentKind } from "../../../generated/prisma/enums"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

/**
 * Verrous et écritures transverses. Ordre de verrouillage constant pour
 * éviter les interblocages : commande, puis paiement, puis remboursement ;
 * l'abonnement d'un compte est sérialisé par un verrou consultatif.
 */
@Injectable()
export class BillingRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(run)
  }

  async lockOrder(tx: Tx, id: bigint): Promise<void> {
    await tx.$queryRaw`SELECT id FROM billing_orders WHERE id = ${id} FOR UPDATE`
  }

  async lockOrderByPublicId(tx: Tx, publicId: string): Promise<bigint | null> {
    if (!isUuid(publicId)) return null
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM billing_orders WHERE public_id = ${publicId}::uuid FOR UPDATE`
    return rows[0]?.id ?? null
  }

  async lockPayment(tx: Tx, id: bigint): Promise<void> {
    await tx.$queryRaw`SELECT id FROM payment_transactions WHERE id = ${id} FOR UPDATE`
  }

  async lockRefund(tx: Tx, id: bigint): Promise<void> {
    await tx.$queryRaw`SELECT id FROM payment_refunds WHERE id = ${id} FOR UPDATE`
  }

  async lockIncident(tx: Tx, id: bigint): Promise<void> {
    await tx.$queryRaw`SELECT id FROM billing_incidents WHERE id = ${id} FOR UPDATE`
  }

  /** Sérialise commandes et attributions de droits d'un même compte. */
  async lockAccount(tx: Tx, userId: bigint): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('billing:account'), ${Number(userId % 2_147_483_647n)}::int)`
  }

  /**
   * Ouvre un incident, sauf s'il en existe déjà un ouvert du même type pour
   * ce paiement (index unique partiel). Renvoie `true` si créé.
   */
  async openIncident(
    db: Db,
    kind: BillingIncidentKind,
    refs: { paymentId?: bigint | null; orderId?: bigint | null },
    detail: Prisma.InputJsonObject,
  ): Promise<boolean> {
    const result = await db.billingIncident.createMany({
      data: [
        {
          kind,
          paymentId: refs.paymentId ?? null,
          orderId: refs.orderId ?? null,
          detail,
        },
      ],
      skipDuplicates: true,
    })
    return result.count > 0
  }
}
