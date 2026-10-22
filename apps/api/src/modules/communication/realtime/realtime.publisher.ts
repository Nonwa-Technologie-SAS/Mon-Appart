import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import type { Namespace } from "socket.io"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { CommunicationActivity } from "../communication-activity"

export function userRoom(userPublicId: string): string {
  return `user:${userPublicId}`
}

/**
 * Diffusion vers les salles personnelles `user:{id}`. Les destinataires sont
 * toujours calculés par le serveur depuis la base ; un client ne rejoint
 * jamais une salle de conversation. Sans passerelle active (tests, temps réel
 * désactivé), l'émission est ignorée : le client se rattrape par l'API REST.
 */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger("Realtime")
  private namespace: Namespace | null = null

  constructor(private readonly activity: CommunicationActivity) {}

  attach(namespace: Namespace): void {
    this.namespace = namespace
  }

  get active(): boolean {
    return this.namespace !== null
  }

  toUsers(
    userPublicIds: Iterable<string>,
    event: string,
    payload: object,
  ): void {
    const rooms = [...new Set(userPublicIds)].map(userRoom)
    if (!this.namespace || rooms.length === 0) return
    try {
      this.namespace
        .to(rooms)
        .emit(event, { eventId: randomUUID(), ...payload })
      this.activity.metrics.communication.eventsEmitted.inc({ event })
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          action: "realtime.emit_failed",
          event,
          error: safeErrorMessage(error),
        }),
      )
    }
  }
}
