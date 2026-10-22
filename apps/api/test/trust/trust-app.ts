import { randomUUID } from "node:crypto"

import type { Response } from "supertest"

import { MediaJobRunner } from "../../src/modules/media"
import { pdf } from "../../src/modules/media/testing/media-fixtures"
import type { TestUser } from "../catalog/catalog-app"
import type { IdentityTestApp } from "../identity/identity-app"
import { pathOf } from "../media/media-app"

/** PDF synthétique au contenu unique : aucune vraie pièce, aucun doublon involontaire. */
export const fakeDocument = () => pdf(`/Producer (test-${randomUUID()})`)

export async function openVerification(
  test: IdentityTestApp,
  user: TestUser,
  body: Record<string, unknown>,
  status = 201,
): Promise<Response> {
  return test.http
    .post("/api/v1/trust/verifications")
    .set(user.auth)
    .send(body)
    .expect(status)
}

/** Pièce envoyée par le parcours réel : session Trust, PUT direct, confirmation Media, traitement. */
export async function attachDocument(
  test: IdentityTestApp,
  user: TestUser,
  verificationId: string,
  documentType: string,
  bytes: Buffer = fakeDocument(),
): Promise<{ documentId: string; uploadId: string }> {
  const opened = await test.http
    .post(`/api/v1/trust/verifications/${verificationId}/documents`)
    .set(user.auth)
    .send({
      documentType,
      mimeType: "application/pdf",
      size: bytes.length,
      filename: "piece.pdf",
    })
    .expect(201)
  const { documentId, upload } = opened.body
  await test.http
    .put(pathOf(upload.upload.url))
    .set(upload.upload.headers)
    .send(bytes)
    .expect(200)
  await test.http
    .post(`/api/v1/media/upload-sessions/${upload.sessionId}/complete`)
    .set(user.auth)
    .send({})
    .expect(200)
  await test.app.get(MediaJobRunner).runOnce()
  return { documentId, uploadId: upload.mediaId }
}

export async function submit(
  test: IdentityTestApp,
  user: TestUser,
  verificationId: string,
  status = 200,
): Promise<Response> {
  return test.http
    .post(`/api/v1/trust/verifications/${verificationId}/submit`)
    .set(user.auth)
    .send({ attestation: true })
    .expect(status)
}

export async function review(
  test: IdentityTestApp,
  user: TestUser,
  verificationId: string,
  action: string,
  body: Record<string, unknown> = {},
  status = 200,
): Promise<Response> {
  return test.http
    .post(`/api/v1/admin/trust/verifications/${verificationId}/${action}`)
    .set(user.auth)
    .send(body)
    .expect(status)
}

/** Dossier d'identité soumis puis approuvé par un agent de confiance. */
export async function verifiedIdentity(
  test: IdentityTestApp,
  user: TestUser,
  officer: TestUser,
): Promise<string> {
  const created = await openVerification(test, user, { type: "IDENTITY" })
  const id: string = created.body.id
  await attachDocument(test, user, id, "NATIONAL_ID")
  await submit(test, user, id)
  await review(test, officer, id, "approve")
  return id
}

export async function notificationsOf(test: IdentityTestApp, user: TestUser) {
  const response = await test.http
    .get("/api/v1/notifications")
    .set(user.auth)
    .expect(200)
  return response.body.items as Array<{
    id: string
    type: string
    title: string
    body: string | null
    data: Record<string, unknown>
    readAt: string | null
  }>
}
