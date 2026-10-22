import type { Client } from "pg"
import {
  connect,
  createFixture,
  expectViolation,
  inRollback,
  SQLSTATE,
} from "./db"

describe("triggers", () => {
  let client: Client

  beforeAll(async () => {
    client = await connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it("équipe chaque table ayant updated_at du trigger set_updated_at", async () => {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT c.table_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
          AND t.table_type = 'BASE TABLE'
          AND NOT EXISTS (
            SELECT 1 FROM pg_trigger tg
             WHERE tg.tgrelid = format('public.%I', c.table_name)::regclass
               AND tg.tgname = c.table_name || '_set_updated_at'
          )`,
    )
    expect(rows).toEqual([])
  })

  it("met à jour updated_at lors d'un UPDATE", async () => {
    await inRollback(client, async () => {
      const { propertyId } = await createFixture(client)
      // now() est figé dans la transaction : on vieillit la ligne pour observer le trigger.
      await client.query(
        "ALTER TABLE properties DISABLE TRIGGER properties_set_updated_at",
      )
      await client.query(
        "UPDATE properties SET updated_at = '2000-01-01' WHERE id = $1",
        [propertyId],
      )
      await client.query(
        "ALTER TABLE properties ENABLE TRIGGER properties_set_updated_at",
      )
      await client.query(
        "UPDATE properties SET title = 'Titre modifié' WHERE id = $1",
        [propertyId],
      )
      const { rows } = await client.query<{ fresh: boolean }>(
        "SELECT updated_at > '2001-01-01' AS fresh FROM properties WHERE id = $1",
        [propertyId],
      )
      expect(rows[0]?.fresh).toBe(true)
    })
  })

  it("rend audit_logs immuable", async () => {
    await inRollback(client, async () => {
      await client.query(
        "INSERT INTO audit_logs (action, entity_type, entity_id) VALUES ('listing.publish', 'listing', 'x')",
      )
      await expectViolation(
        client,
        "UPDATE audit_logs SET action = 'falsifié' WHERE entity_id = 'x'",
        [],
        { code: SQLSTATE.restrictViolation },
      )
    })
  })
})
