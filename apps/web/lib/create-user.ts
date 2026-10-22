/**
 * @deprecated Création d’utilisateurs legacy retirée.
 * Inscription : POST /api/v1/auth/register (Nest).
 * Rôles éditeur : back-office Nest.
 */

export async function createUserWithPassword(): Promise<never> {
  throw new Error(
    "createUserWithPassword retiré : utiliser Nest Identity (/api/v1/auth/register).",
  )
}
