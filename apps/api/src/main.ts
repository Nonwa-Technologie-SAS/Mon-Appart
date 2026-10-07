import "reflect-metadata"

import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { Logger } from "nestjs-pino"

import { AppModule } from "./app.module"
import { configureApp } from "./configure-app"

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  configureApp(app)
  const port = app.get(ConfigService).get<number>("APP_PORT") ?? 4000
  await app.listen(port, "0.0.0.0")
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "démarrage impossible"
  console.error(message)
  process.exit(1)
})
