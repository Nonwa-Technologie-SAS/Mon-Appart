import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module"
import { configureApp } from "../src/configure-app"

describe("Health HTTP", () => {
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

  it("GET /health/live répond sans dépendances", async () => {
    await request(app.getHttpServer())
      .get("/health/live")
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body.status).toBe("ok")
        expect(body.service).toBe("api")
        expect(headers["x-request-id"]).toEqual(expect.any(String))
      })
  })

  it("GET /health/ready est dégradé sans PostgreSQL ni Redis", async () => {
    await request(app.getHttpServer()).get("/health/ready").expect(503)
  })

  it("GET /api/v1/meta expose la version", async () => {
    await request(app.getHttpServer()).get("/api/v1/meta").expect(200).expect({
      name: "mon-appart-api",
      version: "v1",
      status: "ok",
    })
  })
})
