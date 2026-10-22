import { Logger, type INestApplicationContext } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { IoAdapter } from "@nestjs/platform-socket.io"
import { parseCorsOrigins } from "@mon-appart/config"
import { createAdapter } from "@socket.io/redis-adapter"
import type Redis from "ioredis"
import type { Server, ServerOptions } from "socket.io"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { RedisService } from "../../../redis/redis.service"

const MAX_PAYLOAD_BYTES = 64 * 1024

/**
 * Serveur Socket.IO : mêmes origines CORS que l'API, charges utiles bornées,
 * et adaptateur Redis pour diffuser entre plusieurs instances. Sans Redis,
 * l'adaptateur local suffit à une instance ; la persistance n'en dépend pas.
 */
export class RealtimeIoAdapter extends IoAdapter {
  private readonly realtimeLogger = new Logger("Realtime")
  private readonly clients: Redis[] = []

  constructor(private readonly app: INestApplicationContext) {
    super(app)
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const config = this.app.get(ConfigService)
    const server = super.createIOServer(port, {
      ...(options as ServerOptions),
      cors: {
        origin: parseCorsOrigins(
          config.get<string>("CORS_ORIGINS") ?? "",
          config.get<string>("WEB_APP_URL"),
          config.get<string>("ADMIN_APP_URL"),
        ),
        credentials: true,
      },
      maxHttpBufferSize: MAX_PAYLOAD_BYTES,
      serveClient: false,
    }) as Server

    const redis = this.app.get(RedisService, { strict: false }).getClient()
    if (redis) {
      try {
        const pub = redis.duplicate()
        const sub = redis.duplicate()
        for (const client of [pub, sub]) {
          client.on("error", (error: unknown) =>
            this.realtimeLogger.warn(
              JSON.stringify({
                action: "realtime.redis_error",
                error: safeErrorMessage(error),
              }),
            ),
          )
        }
        this.clients.push(pub, sub)
        server.adapter(createAdapter(pub, sub))
      } catch (error) {
        this.realtimeLogger.warn(
          JSON.stringify({
            action: "realtime.redis_adapter_unavailable",
            error: safeErrorMessage(error),
          }),
        )
      }
    }
    return server
  }

  override async close(server: Server): Promise<void> {
    await super.close(server)
    await Promise.all(
      this.clients
        .splice(0)
        .map((client) => client.quit().catch(() => undefined)),
    )
  }
}
