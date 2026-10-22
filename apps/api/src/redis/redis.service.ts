import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"

import { safeErrorMessage } from "../common/http/safe-error"

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis | null = null
  private available = false

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("REDIS_URL")
    if (!url) {
      this.logger.warn("REDIS_URL absent : Redis non connecté")
      return
    }

    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      enableOfflineQueue: false,
    })
    client.on("error", (error: Error) => {
      this.available = false
      this.logger.warn(safeErrorMessage(error))
    })
    this.client = client

    try {
      await client.connect()
      const pong = await client.ping()
      this.available = pong === "PONG"
    } catch (error) {
      this.available = false
      this.logger.warn(
        `Redis indisponible au démarrage : ${safeErrorMessage(error)}`,
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return
    try {
      await this.client.quit()
    } catch {
      this.client.disconnect()
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("REDIS_URL"))
  }

  isAvailable(): boolean {
    return this.available && this.client !== null
  }

  getClient(): Redis | null {
    return this.isAvailable() ? this.client : null
  }

  async ping(): Promise<"up" | "down"> {
    if (!this.client) return "down"
    try {
      const pong = await this.client.ping()
      this.available = pong === "PONG"
      return this.available ? "up" : "down"
    } catch (error) {
      this.available = false
      this.logger.warn(safeErrorMessage(error))
      return "down"
    }
  }
}
