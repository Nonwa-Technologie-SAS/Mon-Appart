import { Client, DatabaseError } from "pg"

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL })
  await client.connect()
  return client
}

/** Exécute le test dans une transaction toujours annulée : la base reste propre. */
export async function inRollback(
  client: Client,
  run: () => Promise<void>,
): Promise<void> {
  await client.query("BEGIN")
  try {
    await run()
  } finally {
    await client.query("ROLLBACK")
  }
}

/** Vérifie qu'une requête échoue avec le code SQLSTATE et la contrainte attendus. */
export async function expectViolation(
  client: Client,
  sql: string,
  params: unknown[],
  expected: { code: string; constraint?: string },
): Promise<void> {
  await client.query("SAVEPOINT expect_violation")
  let error: unknown
  try {
    await client.query(sql, params)
  } catch (caught) {
    error = caught
  }
  await client.query("ROLLBACK TO SAVEPOINT expect_violation")

  expect(error).toBeInstanceOf(DatabaseError)
  const dbError = error as DatabaseError
  expect(dbError.code).toBe(expected.code)
  if (expected.constraint) {
    expect(dbError.constraint).toBe(expected.constraint)
  }
}

export const SQLSTATE = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  checkViolation: "23514",
  generatedAlways: "428C9",
  restrictViolation: "23001",
} as const

export interface Fixture {
  ownerId: string
  customerId: string
  propertyId: string
  otherPropertyId: string
  listingId: string
}

let sequence = 0

/** Crée deux utilisateurs, deux biens et une annonce publiée (Cocody / Riviera). */
export async function createFixture(client: Client): Promise<Fixture> {
  sequence += 1
  const suffix = `${process.pid}${sequence}`.slice(-7).padStart(7, "0")

  const users = await client.query<{ id: string }>(
    `INSERT INTO users (phone, status) VALUES ($1, 'ACTIVE'), ($2, 'ACTIVE') RETURNING id`,
    [`+22501${suffix}`, `+22502${suffix}`],
  )
  const [owner, customer] = users.rows

  const refs = await client.query<{ neighborhood_id: number; type_id: number }>(
    `SELECT n.id AS neighborhood_id, t.id AS type_id
       FROM neighborhoods n
       JOIN communes c ON c.id = n.commune_id
       CROSS JOIN property_types t
      WHERE c.code = 'COCODY' AND n.code = 'RIVIERA' AND t.code = 'APARTMENT'`,
  )
  const ref = refs.rows[0]
  if (!ref || !owner || !customer) {
    throw new Error("Référentiels absents : lancer db:test:migrate")
  }

  const properties = await client.query<{ id: string }>(
    `INSERT INTO properties (property_type_id, neighborhood_id, title, latitude, longitude, status)
     VALUES ($1, $2, 'Bien test A', 5.359000, -3.958000, 'ACTIVE'),
            ($1, $2, 'Bien test B', 5.293000, -3.985000, 'ACTIVE')
     RETURNING id`,
    [ref.type_id, ref.neighborhood_id],
  )
  const [property, otherProperty] = properties.rows
  if (!property || !otherProperty) {
    throw new Error("Création des biens impossible")
  }

  const listing = await client.query<{ id: string }>(
    `INSERT INTO listings (property_id, created_by_id, listing_type, status, title, published_at)
     VALUES ($1, $2, 'RENT', 'PUBLISHED', 'Annonce test', now()) RETURNING id`,
    [property.id, owner.id],
  )

  return {
    ownerId: owner.id,
    customerId: customer.id,
    propertyId: property.id,
    otherPropertyId: otherProperty.id,
    listingId: listing.rows[0]!.id,
  }
}
