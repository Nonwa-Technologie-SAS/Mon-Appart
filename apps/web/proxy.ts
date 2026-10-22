import { NextRequest, NextResponse } from "next/server"

/**
 * Garde légère : présence d’une session Nest (refresh / CSRF / access).
 * La validation JWT complète se fait dans les pages / Server Actions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const needsAuth =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/espace") ||
    pathname.startsWith("/profil")

  if (!needsAuth) {
    return NextResponse.next()
  }

  const hasNestSession =
    Boolean(request.cookies.get("ma_refresh")?.value) ||
    Boolean(request.cookies.get("ma_csrf")?.value) ||
    Boolean(request.cookies.get("ma_access")?.value)

  if (!hasNestSession) {
    const loginUrl = new URL("/connexion", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/espace", "/espace/:path*", "/profil", "/profil/:path*"],
}
