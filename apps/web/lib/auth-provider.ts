/**
 * Le site public utilise exclusivement Nest Identity.
 * better-auth / mon_appart_legacy ne sont plus des chemins supportés.
 */

export type AuthProvider = "nest"

export function getAuthProvider(): AuthProvider {
  return "nest"
}

export function isNestAuth(): boolean {
  return true
}
