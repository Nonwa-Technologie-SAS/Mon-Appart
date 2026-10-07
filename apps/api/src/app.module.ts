import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { parseApiEnv } from "@mon-appart/config"

import { AppController } from "./app.controller"
import { CacheModule } from "./common/cache/cache.module"
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter"
import { MetricsInterceptor } from "./common/interceptors/metrics.interceptor"
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware"
import { DatabaseModule } from "./database/database.module"
import { DomainEventsModule } from "./common/events/domain-events.module"
import { HealthModule } from "./health/health.module"
import { LoggerModule } from "./logging/logger.module"
import { domainModules } from "./modules/domain"
import { ObservabilityModule } from "./observability/observability.module"
import { RedisThrottlerStorage } from "./redis/redis-throttler.storage"
import { RedisModule } from "./redis/redis.module"
import { SecurityModule } from "./security/security.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: (env: Record<string, unknown>) => parseApiEnv(env),
    }),
    LoggerModule,
    RedisModule,
    CacheModule,
    DatabaseModule,
    DomainEventsModule,
    ObservabilityModule,
    SecurityModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ name: "default", ttl: 60_000, limit: 120 }],
        storage,
      }),
    }),
    HealthModule,
    ...domainModules,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: "{*path}", method: RequestMethod.ALL })
  }
}
