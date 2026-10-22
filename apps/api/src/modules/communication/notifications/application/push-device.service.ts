import { Injectable } from "@nestjs/common"
import { createHash } from "node:crypto"

import { DatabaseService } from "../../../../database/database.service"
import type { PushPlatform } from "../../../../generated/prisma/enums"
import type { Actor, ClientContext } from "../../../identity"
import { CommunicationActivity } from "../../communication-activity"
import { communicationError } from "../../domain/communication-errors"
import {
  CommunicationAuditAction,
  USER_ENTITY,
} from "../../domain/communication-events"

export interface PushDeviceView {
  id: string
  platform: PushPlatform
  lastSeenAt: Date
  createdAt: Date
}

const MAX_ACTIVE_DEVICES = 10

/** Empreinte d'un jeton push : seule forme utilisée pour l'unicité et l'audit. */
export function pushTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Jetons push des applications (Flutter, FCM/APNs). Le jeton est stocké pour
 * l'envoi mais n'apparaît jamais dans une réponse, un log ni l'audit.
 */
@Injectable()
export class PushDeviceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: CommunicationActivity,
  ) {}

  async register(
    actor: Actor,
    input: { token: string; platform: PushPlatform },
    client: ClientContext,
  ): Promise<PushDeviceView> {
    const token = input.token.trim()
    const tokenSha256 = pushTokenHash(token)
    const now = new Date()
    const device = await this.db.transaction(async (tx) => {
      // Un même appareil passé sur un autre compte change de propriétaire.
      const saved = await tx.pushDevice.upsert({
        where: { tokenSha256 },
        create: {
          userId: actor.userId,
          platform: input.platform,
          token,
          tokenSha256,
          lastSeenAt: now,
        },
        update: {
          userId: actor.userId,
          platform: input.platform,
          lastSeenAt: now,
          invalidatedAt: null,
        },
        select: {
          id: true,
          publicId: true,
          platform: true,
          lastSeenAt: true,
          createdAt: true,
        },
      })
      const stale = await tx.pushDevice.findMany({
        where: { userId: actor.userId, invalidatedAt: null },
        orderBy: { lastSeenAt: "desc" },
        skip: MAX_ACTIVE_DEVICES,
        select: { id: true },
      })
      if (stale.length > 0) {
        await tx.pushDevice.updateMany({
          where: { id: { in: stale.map((row) => row.id) } },
          data: { invalidatedAt: now },
        })
      }
      await this.activity.audit(
        {
          action: CommunicationAuditAction.PUSH_DEVICE_REGISTERED,
          actorId: actor.userId,
          entityType: USER_ENTITY,
          entityId: actor.publicId,
          newValues: { deviceId: saved.publicId, platform: input.platform },
        },
        client,
        tx,
      )
      return saved
    })
    return {
      id: device.publicId,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    }
  }

  async remove(
    actor: Actor,
    devicePublicId: string,
    client: ClientContext,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const result = await tx.pushDevice.deleteMany({
        where: { publicId: devicePublicId, userId: actor.userId },
      })
      if (result.count === 0) throw communicationError("PUSH_DEVICE_NOT_FOUND")
      await this.activity.audit(
        {
          action: CommunicationAuditAction.PUSH_DEVICE_REMOVED,
          actorId: actor.userId,
          entityType: USER_ENTITY,
          entityId: actor.publicId,
          newValues: { deviceId: devicePublicId },
        },
        client,
        tx,
      )
    })
  }

  async list(actor: Actor): Promise<PushDeviceView[]> {
    const rows = await this.db.client.pushDevice.findMany({
      where: { userId: actor.userId, invalidatedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: {
        publicId: true,
        platform: true,
        lastSeenAt: true,
        createdAt: true,
      },
    })
    return rows.map((row) => ({
      id: row.publicId,
      platform: row.platform,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
    }))
  }
}
