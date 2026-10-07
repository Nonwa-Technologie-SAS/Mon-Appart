import {
  corsPreflight,
  withCors,
} from "@/lib/cors"
import {
  credentialsSchema,
  firstZodError,
} from "@/lib/auth-schemas"
import { createUserWithPassword } from "@/lib/create-user"
import { Role } from "@/prisma/generated/client/enums"

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return withCors(
      request,
      Response.json({ error: "JSON invalide" }, { status: 400 })
    )
  }

  const parsed = credentialsSchema.safeParse(body)
  if (!parsed.success) {
    return withCors(
      request,
      Response.json({ error: firstZodError(parsed.error) }, { status: 400 })
    )
  }

  try {
    const user = await createUserWithPassword(parsed.data, Role.OWNER)
    return withCors(
      request,
      Response.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer le compte"
    const status = message.includes("existe déjà") ? 409 : 500
    return withCors(
      request,
      Response.json({ error: message }, { status })
    )
  }
}
