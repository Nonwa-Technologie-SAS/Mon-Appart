import type { INestApplication, Type } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import type { Client } from "pg"
import request from "supertest"

import { AppModule } from "../../src/app.module"
import { configureApp } from "../../src/configure-app"
import { IdentityConfig } from "../../src/modules/identity/identity.config"
import { DevNotificationProvider } from "../../src/modules/identity/infrastructure/providers/notification.providers"
import { connect } from "../database/db"

export interface IdentityTestApp {
  app: INestApplication
  http: ReturnType<typeof request>
  outbox: DevNotificationProvider
  db: Client
  close(): Promise<void>
}

/**
 * Application complète branchée sur la base *_test (jamais la base de dev).
 * `overrides` ajuste la configuration Identity (limites, durées) pour un fichier.
 */
export async function createIdentityApp(
  overrides: Partial<Record<keyof IdentityConfig, unknown>> = {},
  controllers: Type[] = [],
): Promise<IdentityTestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  })
    .overrideProvider(IdentityConfig)
    .useFactory({
      inject: [ConfigService],
      factory: (config: ConfigService) =>
        Object.assign(new IdentityConfig(config), overrides),
    })
    .compile()

  const databaseUrl =
    moduleRef.get(ConfigService).get<string>("DATABASE_URL") ?? ""
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
    throw new Error("Les tests Identity exigent une DATABASE_URL *_test")
  }

  const app = moduleRef.createNestApplication({
    bufferLogs: true,
    rawBody: true,
  })
  configureApp(app)
  await app.init()

  const db = await connect()
  return {
    app,
    http: request(app.getHttpServer()),
    outbox: app.get(DevNotificationProvider),
    db,
    async close() {
      await db.end()
      await app.close()
    },
  }
}

let sequence = 0

export function uniquePhone(): string {
  sequence += 1
  const digits = `${process.pid}${Date.now()}${sequence}`.slice(-8)
  return `+22507${digits}`
}

export function uniqueEmail(): string {
  sequence += 1
  return `identity-${Date.now()}-${process.pid}-${sequence}@example.test`
}

export const PASSWORD = "une phrase de passe solide"
export const NEW_PASSWORD = "une autre phrase encore meilleure"

export interface RegisteredUser {
  email: string
  phone: string
  password: string
  accessToken: string
  refreshToken: string
  sessionId: string
  userId: string
}

export async function registerUser(
  test: IdentityTestApp,
  overrides: Partial<{ email: string; phone: string; password: string }> = {},
): Promise<RegisteredUser> {
  const email = overrides.email ?? uniqueEmail()
  const phone = overrides.phone ?? uniquePhone()
  const password = overrides.password ?? PASSWORD
  const response = await test.http
    .post("/api/v1/auth/register")
    .send({ email, phone, password, firstName: "Awa" })
    .expect(201)
  return {
    email,
    phone,
    password,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    sessionId: response.body.sessionId,
    userId: response.body.user.id,
  }
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}

export function login(
  test: IdentityTestApp,
  identifier: string,
  password: string,
) {
  return test.http.post("/api/v1/auth/login").send({ identifier, password })
}

/** Vérifie le téléphone du compte avec le code capté par le fournisseur de dev. */
export async function verifyPhone(
  test: IdentityTestApp,
  user: RegisteredUser,
): Promise<void> {
  await test.http
    .post("/api/v1/auth/phone/verify/request")
    .set(bearer(user.accessToken))
    .expect(202)
  const code = test.outbox.latest(user.phone, "verification_code")?.code
  await test.http
    .post("/api/v1/auth/phone/verify/confirm")
    .set(bearer(user.accessToken))
    .send({ code })
    .expect(200)
}
