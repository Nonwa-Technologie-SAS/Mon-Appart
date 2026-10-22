import { Logger, type OnApplicationShutdown } from "@nestjs/common"
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from "@nestjs/websockets"
import { SkipThrottle } from "@nestjs/throttler"
import type { Namespace, Socket } from "socket.io"

import { AppException } from "../../../common/http/app-exception"
import { safeErrorMessage } from "../../../common/http/safe-error"
import {
  AccessTokenService,
  ActorService,
  SessionRevocationStore,
  type Actor,
  type AuthenticatedUser,
} from "../../identity"
import { CommunicationActivity } from "../communication-activity"
import { CommunicationConfig } from "../communication.config"
import { MessageService } from "../messaging/application/message.service"
import { RealtimePublisher, userRoom } from "./realtime.publisher"

interface SocketState {
  userPublicId: string
  sessionId: string
  roles: AuthenticatedUser["roles"]
  expiresAt: number
  window: { startedAt: number; count: number }
}

type Ack =
  ({ ok: true } & Record<string, unknown>) | { ok: false; code: string }

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_SEQ = 2_147_483_647
const MAX_TIMER_MS = 2_147_483_647

export const REALTIME_NAMESPACE = "/realtime"

/**
 * Temps réel (Socket.IO, namespace `/realtime`). Authentification à la
 * connexion par l'access token (`auth.token`), révocation revérifiée
 * périodiquement, déconnexion à l'expiration du jeton. Chaque socket ne
 * rejoint que sa salle personnelle : les destinataires d'un événement sont
 * calculés par le serveur. La persistance ne dépend jamais de ce canal ; le
 * client se rattrape par l'API REST (`after=`).
 */
@SkipThrottle()
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway
  implements
    OnGatewayInit<Namespace>,
    OnGatewayConnection<Socket>,
    OnGatewayDisconnect<Socket>,
    OnApplicationShutdown
{
  private readonly logger = new Logger("Realtime")
  private readonly expiry = new Map<string, NodeJS.Timeout>()
  private revocationTimer: NodeJS.Timeout | null = null
  private namespace: Namespace | null = null

  constructor(
    private readonly tokens: AccessTokenService,
    private readonly revocations: SessionRevocationStore,
    private readonly actors: ActorService,
    private readonly messages: MessageService,
    private readonly publisher: RealtimePublisher,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
  ) {}

  afterInit(namespace: Namespace): void {
    this.namespace = namespace
    namespace.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        (error: unknown) => {
          const code =
            error instanceof AppException ? error.code : "UNAUTHENTICATED"
          this.activity.metrics.communication.socketRejected.inc({
            reason: code,
          })
          const refusal = new Error(code) as Error & { data?: unknown }
          refusal.data = { code }
          next(refusal)
        },
      )
    })
    if (!this.config.realtime.enabled) return
    this.publisher.attach(namespace)
    this.revocationTimer = setInterval(
      () => void this.checkRevocations(),
      this.config.realtime.revocationCheckMs,
    )
    this.revocationTimer.unref()
  }

  handleConnection(socket: Socket): void {
    const state = socket.data as SocketState | undefined
    if (!state?.userPublicId) {
      socket.disconnect(true)
      return
    }
    void socket.join(userRoom(state.userPublicId))
    this.activity.metrics.communication.socketConnections.inc()
    const remaining = Math.min(state.expiresAt - Date.now(), MAX_TIMER_MS)
    const timer = setTimeout(
      () => {
        socket.emit("session:expired", { code: "TOKEN_EXPIRED" })
        socket.disconnect(true)
      },
      Math.max(0, remaining),
    )
    timer.unref()
    this.expiry.set(socket.id, timer)
  }

  handleDisconnect(socket: Socket): void {
    const timer = this.expiry.get(socket.id)
    if (timer) {
      clearTimeout(timer)
      this.expiry.delete(socket.id)
      this.activity.metrics.communication.socketConnections.dec()
    }
  }

  onApplicationShutdown(): void {
    if (this.revocationTimer) clearInterval(this.revocationTimer)
    for (const timer of this.expiry.values()) clearTimeout(timer)
    this.expiry.clear()
  }

  @SubscribeMessage("conversation:read")
  onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack> {
    return this.handle(socket, body, async (actor, input) => {
      const result = await this.messages.markRead(
        actor,
        input.conversationId,
        input.upToSeq,
      )
      return { ok: true, ...result }
    })
  }

  @SubscribeMessage("message:delivered")
  onDelivered(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack> {
    return this.handle(socket, body, async (actor, input) => {
      if (input.upToSeq === undefined)
        return { ok: false, code: "VALIDATION_FAILED" }
      const result = await this.messages.markDelivered(
        actor,
        input.conversationId,
        input.upToSeq,
      )
      return { ok: true, ...result }
    })
  }

  private async authenticate(socket: Socket): Promise<void> {
    if (!this.config.realtime.enabled) {
      throw new AppException("REALTIME_DISABLED", 503, "Temps réel désactivé")
    }
    const auth = socket.handshake.auth as Record<string, unknown> | undefined
    const token =
      typeof auth?.token === "string"
        ? auth.token.replace(/^Bearer\s+/i, "")
        : bearer(socket.handshake.headers.authorization)
    if (!token) {
      throw new AppException("UNAUTHENTICATED", 401, "Authentification requise")
    }
    const claims = await this.tokens.verify(token)
    if (await this.revocations.isRevoked(claims.sessionId)) {
      throw new AppException("SESSION_REVOKED", 401, "Session révoquée")
    }
    // Compte bloqué ou supprimé : refusé comme sur l'API REST.
    await this.actors.resolve({
      id: claims.sub,
      sessionId: claims.sessionId,
      roles: claims.roles,
    })
    const state: SocketState = {
      userPublicId: claims.sub,
      sessionId: claims.sessionId,
      roles: claims.roles,
      expiresAt: claims.exp * 1_000,
      window: { startedAt: Date.now(), count: 0 },
    }
    socket.data = state
  }

  /**
   * Validation, limite par socket et erreurs converties en accusé
   * `{ ok: false, code }` : rien n'est relayé au filtre HTTP.
   */
  private async handle(
    socket: Socket,
    body: unknown,
    run: (
      actor: Actor,
      input: { conversationId: string; upToSeq?: number },
    ) => Promise<Ack>,
  ): Promise<Ack> {
    const state = socket.data as SocketState
    if (!this.withinRate(state)) return { ok: false, code: "TOO_MANY_REQUESTS" }
    const input = parseInput(body)
    if (!input) return { ok: false, code: "VALIDATION_FAILED" }
    try {
      const actor = await this.actors.resolve({
        id: state.userPublicId,
        sessionId: state.sessionId,
        roles: state.roles,
      })
      return await run(actor, input)
    } catch (error) {
      if (error instanceof AppException) return { ok: false, code: error.code }
      this.logger.warn(
        JSON.stringify({
          action: "realtime.event_failed",
          error: safeErrorMessage(error),
        }),
      )
      return { ok: false, code: "INTERNAL_ERROR" }
    }
  }

  private withinRate(state: SocketState): boolean {
    const now = Date.now()
    if (now - state.window.startedAt >= 60_000) {
      state.window = { startedAt: now, count: 0 }
    }
    state.window.count += 1
    return state.window.count <= this.config.realtime.eventRateLimit
  }

  /** Sessions révoquées (déconnexion, mot de passe changé) : sockets fermés. */
  private async checkRevocations(): Promise<void> {
    if (!this.namespace) return
    for (const socket of this.namespace.sockets.values()) {
      const state = socket.data as SocketState | undefined
      if (!state?.sessionId) continue
      try {
        if (await this.revocations.isRevoked(state.sessionId)) {
          socket.emit("session:expired", { code: "SESSION_REVOKED" })
          socket.disconnect(true)
        }
      } catch {
        // Redis indisponible : la prochaine vérification réessaiera.
      }
    }
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token, extra] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token || extra !== undefined) {
    return null
  }
  return token
}

function parseInput(
  body: unknown,
): { conversationId: string; upToSeq?: number } | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const { conversationId, upToSeq } = record
  if (typeof conversationId !== "string" || !UUID_V4.test(conversationId)) {
    return null
  }
  if (upToSeq === undefined) return { conversationId }
  if (
    typeof upToSeq !== "number" ||
    !Number.isInteger(upToSeq) ||
    upToSeq < 0 ||
    upToSeq > MAX_SEQ
  ) {
    return null
  }
  return { conversationId, upToSeq }
}
