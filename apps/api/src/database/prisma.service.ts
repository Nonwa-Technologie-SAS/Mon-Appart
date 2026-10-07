import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaPg } from "@prisma/adapter-pg"
import type { DependencyCheck } from "@mon-appart/types"
import { PrismaClient } from "../generated/prisma/client"

import { safeErrorMessage } from "../common/http/safe-error"

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private client: PrismaClient | null = null

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.config.get<string>("DATABASE_URL")
    if (!connectionString) {
      this.logger.warn("DATABASE_URL absent : PostgreSQL non connecté")
      return
    }

    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 2_000,
    })
    this.client = new PrismaClient({ adapter })

    try {
      await this.client.$connect()
    } catch (error) {
      this.logger.warn(
        `PostgreSQL indisponible au démarrage : ${safeErrorMessage(error)}`,
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect()
  }

  getClient(): PrismaClient | null {
    return this.client
  }

  async checkPostgres(): Promise<DependencyCheck> {
    if (!this.client) return { status: "down", detail: "not_configured" }
    try {
      await this.client.$queryRaw`SELECT 1`
      return { status: "up" }
    } catch (error) {
      this.logger.warn(safeErrorMessage(error))
      return { status: "down", detail: "unavailable" }
    }
  }

  async checkPostgis(): Promise<DependencyCheck> {
    if (!this.client) return { status: "down", detail: "not_configured" }
    try {
      const rows = await this.client.$queryRaw<Array<{ version: string }>>`
        SELECT PostGIS_Version() AS version
      `
      if (!rows[0]?.version) {
        return { status: "down", detail: "postgis_unavailable" }
      }
      return { status: "up" }
    } catch (error) {
      this.logger.warn(safeErrorMessage(error))
      return { status: "down", detail: "postgis_unavailable" }
    }
  }
}
