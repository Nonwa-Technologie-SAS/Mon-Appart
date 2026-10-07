import { randomUUID } from "node:crypto"

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/

export function resolveRequestId(
  header: string | string[] | undefined,
  existing?: unknown,
): string {
  if (typeof existing === "string" && SAFE_REQUEST_ID.test(existing)) {
    return existing
  }
  const raw = Array.isArray(header) ? header[0] : header
  if (raw && SAFE_REQUEST_ID.test(raw)) return raw
  return randomUUID()
}
