import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)
  const needsAuth =
    pathname.startsWith("/admin") || pathname.startsWith("/espace")

  if (needsAuth && !sessionCookie) {
    const loginUrl = new URL("/connexion", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/espace", "/espace/:path*"],
}
