import {
  INestApplication,
  RequestMethod,
  VersioningType,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { isSwaggerEnabled, parseCorsOrigins } from "@mon-appart/config"
import compression from "compression"
import helmet from "helmet"

import { createValidationPipe } from "./common/pipes/validation.pipe"

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService)
  const swaggerEnabled = isSwaggerEnabled({
    APP_ENV: config.get<string>("APP_ENV") ?? "local",
    SWAGGER_ENABLED: config.get<string>("SWAGGER_ENABLED"),
  })

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  )
  app.use(compression())
  app.enableCors({
    origin: parseCorsOrigins(config.get<string>("CORS_ORIGINS") ?? ""),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
  })
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "health", method: RequestMethod.GET },
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
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
  app.enableShutdownHooks()

  if (!swaggerEnabled) return

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Mon Appart API")
      .setDescription("Socle de l'API. Les ressources métier seront ajoutées progressivement.")
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  )
  SwaggerModule.setup("docs", app, document)
}
