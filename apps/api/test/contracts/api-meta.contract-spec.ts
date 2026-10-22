/**
 * Contrat minimal : la surface publique de santé/métadonnées reste stable.
 * Les contrats DTO complets (OpenAPI généré) restent à brancher quand le
 * client frontend Nest sera généré depuis Swagger.
 */
import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { AppModule } from "../../src/app.module"
import { configureApp } from "../../src/configure-app"

describe("contrat API meta / health", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication({ bufferLogs: true })
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("GET /api/v1/meta respecte le schéma stable", async () => {
    const { body } = await request(app.getHttpServer())
      .get("/api/v1/meta")
      .expect(200)

    expect(Object.keys(body).sort()).toEqual(["name", "status", "version"])
    expect(body).toEqual({
      name: "mon-appart-api",
      version: "v1",
      status: "ok",
    })
  })

  it("GET /health/live ne fuit pas de secrets", async () => {
    const { body, text } = await request(app.getHttpServer())
      .get("/health/live")
      .expect(200)

    expect(JSON.stringify(body)).not.toMatch(/secret|password|token|jwt/i)
    expect(text).not.toMatch(/dev-only|change-me/i)
  })
})
