/**
 * @deprecated Prisma web / mon_appart_legacy retiré.
 * Toutes les données métier passent par Nest (`NEST_API_URL`).
 */

export function withPrismaRetry<T>(): Promise<T> {
  return Promise.reject(
    new Error(
      "Prisma web retiré : utilisez l’API Nest (/api/v1/*).",
    ),
  )
}

export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Prisma web retiré : utilisez l’API Nest (/api/v1/*).",
      )
    },
  },
) as never
