import { Algorithm, hash, verify } from "@node-rs/argon2"

export interface Argon2Options {
  memoryCost: number
  timeCost: number
  parallelism: number
}

/** Paramètres OWASP pour Argon2id (mémoire 19 MiB, 2 itérations). */
export const DEFAULT_ARGON2_OPTIONS: Argon2Options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
}

export class PasswordHasher {
  private dummyHash: Promise<string> | null = null

  constructor(
    private readonly options: Argon2Options = DEFAULT_ARGON2_OPTIONS,
  ) {}

  hash(password: string): Promise<string> {
    return hash(password, { ...this.options, algorithm: Algorithm.Argon2id })
  }

  /** Les paramètres sont relus dans le hash : un changement de coût reste compatible. */
  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password)
    } catch {
      return false
    }
  }

  /**
   * Vérification factice quand le compte n'existe pas ou n'a pas de mot de
   * passe : le temps de réponse ne révèle pas l'existence du compte.
   */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash("mon-appart-timing-equalizer")
    await this.verify(await this.dummyHash, password)
    return false
  }
}

const defaultHasher = new PasswordHasher()

export function hashPassword(password: string): Promise<string> {
  return defaultHasher.hash(password)
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return defaultHasher.verify(passwordHash, password)
}
