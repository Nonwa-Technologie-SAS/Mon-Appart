import { z } from "zod"

export const cursorPaginationSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CursorPagination = z.infer<typeof cursorPaginationSchema>

interface CursorPayload {
  id: string
  createdAt: string
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    )
    if (!parsed || typeof parsed !== "object") return null
    const record = parsed as Record<string, unknown>
    if (typeof record.id !== "string" || typeof record.createdAt !== "string") {
      return null
    }
    return { id: record.id, createdAt: record.createdAt }
  } catch {
    return null
  }
}

/** Texte affichable. Ne pas l'utiliser sur un mot de passe ou un jeton. */
export function sanitizePlainText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim()
}
