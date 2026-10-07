import { Algorithm, hash, verify } from "@node-rs/argon2"

/** Paramètres OWASP pour Argon2id (mémoire 19 MiB, 2 itérations). */
export const PASSWORD_HASH_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_OPTIONS)
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password, PASSWORD_HASH_OPTIONS)
}
