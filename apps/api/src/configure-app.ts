import { INestApplication, RequestMethod, VersioningType } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { isSwaggerEnabled, parseCorsOrigins } from "@mon-appart/config"
import compression from "compression"
import cookieParser from "cookie-parser"
import helmet from "helmet"

import { createValidationPipe } from "./common/pipes/validation.pipe"
import { RealtimeIoAdapter } from "./modules/communication"

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService)
  const swaggerEnabled = isSwaggerEnabled({
    APP_ENV: config.get<string>("APP_ENV") ?? "local",
    SWAGGER_ENABLED: config.get<string>("SWAGGER_ENABLED"),
  })

  const trustProxy = config.get<string>("TRUST_PROXY")
  if (trustProxy) {
    const value = /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy
    ;(app as NestExpressApplication).set("trust proxy", value)
  }

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  )
  app.use(compression())
  app.use(cookieParser())
  // Liste explicite, jamais `*` : les cookies d'authentification exigent credentials.
  app.enableCors({
    origin: parseCorsOrigins(
      config.get<string>("CORS_ORIGINS") ?? "",
      config.get<string>("WEB_APP_URL"),
      config.get<string>("ADMIN_APP_URL"),
    ),
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-CSRF-Token",
      "X-Auth-Transport",
    ],
    exposedHeaders: ["X-Request-ID", "Retry-After"],
  })
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "health", method: RequestMethod.GET },
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
      { path: "health/search", method: RequestMethod.GET },
      { path: "metrics", method: RequestMethod.GET },
      { path: "docs", method: RequestMethod.ALL },
      { path: "docs/{*path}", method: RequestMethod.ALL },
    ],
  })
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  })
  app.useGlobalPipes(createValidationPipe())
  app.useWebSocketAdapter(new RealtimeIoAdapter(app))
  app.enableShutdownHooks()

  if (!swaggerEnabled) return

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Mon Appart API")
      .setDescription(
        "API Mon Appart. Les erreurs suivent le format `{ statusCode, code, message, details, requestId, timestamp, path }`.",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  )
  SwaggerModule.setup("docs", app, document)
}
