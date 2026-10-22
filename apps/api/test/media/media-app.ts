import type { Response } from "supertest"

import { MediaJobRunner } from "../../src/modules/media"
import type { TestUser } from "../catalog/catalog-app"
import type { IdentityTestApp } from "../identity/identity-app"

export interface UploadTarget {
  url: string
  method: "PUT"
  headers: Record<string, string>
  contentLength: number
}

export interface Session {
  sessionId: string
  mediaId: string
  status: string
  errorCode: string | null
  upload?: UploadTarget
  media?: {
    id: string
    url: string | null
    isPrimary: boolean
    variants: Array<{
      kind: string
      url: string
      width: number
      height: number
    }>
  }
}

export interface SessionRequest {
  type: "IMAGE" | "IMAGE_360" | "VIDEO" | "DOCUMENT"
  mimeType: string
  size: number
  filename?: string
  visibility?: "PUBLIC" | "PRIVATE"
}

/** Chemin relatif d'une URL du stockage local, appelable par supertest. */
export const pathOf = (url: string) => {
  const parsed = new URL(url)
  return `${parsed.pathname}${parsed.search}`
}

export async function openSession(
  test: IdentityTestApp,
  user: TestUser,
  propertyId: string,
  body: SessionRequest,
  status = 201,
): Promise<Response> {
  return test.http
    .post("/api/v1/media/upload-sessions")
    .set(user.auth)
    .send({ propertyId, ...body })
    .expect(status)
}

export function putFile(
  test: IdentityTestApp,
  upload: UploadTarget,
  bytes: Buffer,
) {
  return test.http.put(pathOf(upload.url)).set(upload.headers).send(bytes)
}

export function complete(
  test: IdentityTestApp,
  user: TestUser,
  sessionId: string,
) {
  return test.http
    .post(`/api/v1/media/upload-sessions/${sessionId}/complete`)
    .set(user.auth)
    .send({})
}

/** Envoi complet par l'API : session, PUT direct, confirmation, traitement. */
export async function uploadMedia(
  test: IdentityTestApp,
  user: TestUser,
  propertyId: string,
  bytes: Buffer,
  body: Omit<SessionRequest, "size">,
): Promise<Session> {
  const opened = await openSession(test, user, propertyId, {
    ...body,
    size: bytes.length,
  })
  const session = opened.body as Session
  await putFile(test, session.upload!, bytes).expect(200)
  await complete(test, user, session.sessionId).expect(200)
  await test.app.get(MediaJobRunner).runOnce()
  const current = await test.http
    .get(`/api/v1/media/upload-sessions/${session.sessionId}`)
    .set(user.auth)
    .expect(200)
  return current.body as Session
}

export async function mediaRow(test: IdentityTestApp, mediaId: string) {
  const result = await test.db.query<{
    status: string
    visibility: string
    storage_key: string
    processing_attempts: number
    processing_error: string | null
    next_attempt_at: Date | null
    deleted_at: Date | null
    purge_after: Date | null
    purged_at: Date | null
    url: string | null
    sort_order: number
  }>(
    `SELECT status, visibility, storage_key, processing_attempts, processing_error,
            next_attempt_at, deleted_at, purge_after, purged_at, url, sort_order
     FROM media WHERE public_id = $1`,
    [mediaId],
  )
  return result.rows[0]!
}
