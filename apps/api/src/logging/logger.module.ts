import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { LoggerModule as PinoLoggerModule } from "nestjs-pino"
import type { IncomingMessage } from "node:http"

import { resolveRequestId } from "../common/http/request-id"
import { LOG_REDACT_PATHS } from "./redact-paths"

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const level = config.get<string>("LOG_LEVEL") ?? "info"
        const pretty = config.get<string>("APP_ENV") === "local"
        return {
          pinoHttp: {
            level,
            base: { service: "api" },
            redact: { paths: LOG_REDACT_PATHS, censor: "[Redacted]" },
            genReqId: (request: IncomingMessage, response) => {
              const requestId = resolveRequestId(
                request.headers["x-request-id"],
                "id" in request && typeof request.id === "string"
                  ? request.id
                  : undefined,
              )
              response.setHeader("X-Request-ID", requestId)
              return requestId
            },
            customProps: (request: IncomingMessage) => {
              const user =
                "user" in request && request.user && typeof request.user === "object"
                  ? (request.user as { id?: string })
                  : undefined
              return {
                request_id: "id" in request ? request.id : undefined,
                ...(user?.id ? { user_id: user.id } : {}),
              }
            },
            autoLogging: {
              ignore: (request: IncomingMessage) =>
                request.url === "/health/live",
            },
            transport: pretty
              ? {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: "SYS:standard",
                  },
                }
              : undefined,
          },
        }
      },
    }),
  ],
})
export class LoggerModule {}
