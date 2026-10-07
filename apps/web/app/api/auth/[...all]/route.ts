import { auth } from "@/lib/auth"
import { corsPreflight, withCors } from "@/lib/cors"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(auth)

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(request: Request) {
  const response = await handlers.GET(request)
  return withCors(request, response)
}

export async function POST(request: Request) {
  const response = await handlers.POST(request)
  return withCors(request, response)
}
